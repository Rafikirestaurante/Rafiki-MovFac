import {SyncBatch, gmailFetch} from '../_shared/syncBatch.ts';
import {workspaceBanks} from "../_shared/workspaceBanks.ts";
import { bankQuery } from "../_shared/banks.ts";
import { extractNequiMovement } from "../_shared/nequi.ts";
import { optionsResponse } from "../_shared/cors.ts";
import { jsonResponse, errorMessage } from "../_shared/http.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { refreshGoogleAccessToken } from "../_shared/google.ts";
import { adminClient, requireAppAdmin } from "../_shared/supabase.ts";

import {
  BANCOLOMBIA_EXTRACTOR_VERSION,

  extractBancolombiaMovement,
  flattenText,
  htmlToText,
  isBancolombiaSender,
  isBancolombiaNotification,
  senderEmail
} from "../_shared/bancolombia.ts";

type GmailListResponse = { messages?: Array<{ id: string; threadId?: string }>; nextPageToken?: string; resultSizeEstimate?: number };
type GmailBody = { size?: number; data?: string; attachmentId?: string };
type GmailPart = { mimeType?: string; filename?: string; body?: GmailBody; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
};
type GmailAttachment = { data?: string; size?: number };

function isoDay(value: unknown, fallback: Date): string {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback.toISOString().slice(0, 10);
  return text;
}

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || "";
}

async function gmailJson<T>(url: string, token: string): Promise<T> {
  const response = await gmailFetch(url, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gmail respondió: ${String(data.error?.message || response.statusText)}`);
  return data as T;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function partData(messageId: string, part: GmailPart, token: string): Promise<string> {
  if (part.body?.data) return decodeBase64Url(part.body.data);
  if (!part.body?.attachmentId) return "";
  const attachment = await gmailJson<GmailAttachment>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
    token
  );
  return attachment.data ? decodeBase64Url(attachment.data) : "";
}

async function extractMessageText(message: GmailMessage, token: string): Promise<{ text: string; html: string }> {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];

  async function walk(part?: GmailPart): Promise<void> {
    if (!part) return;
    const mime = String(part.mimeType || "").toLowerCase();
    if (mime === "text/plain") {
      const value = await partData(message.id, part, token);
      if (value) plainParts.push(value);
    } else if (mime === "text/html") {
      const value = await partData(message.id, part, token);
      if (value) htmlParts.push(value);
    }
    for (const child of part.parts || []) await walk(child);
  }

  await walk(message.payload);
  const html = htmlParts.join(" ");
  const text = flattenText(plainParts.join(" ") || htmlToText(html) || message.snippet || "");
  return { text, html };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function handleMovementSync(request: Request, trustedContext?: Awaited<ReturnType<typeof requireAppAdmin>>) {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse(request, { error: "Método no permitido." }, 405);

  let batch: SyncBatch | null = null;
  let syncRunId: number | null = null;
  let operationClient: ReturnType<typeof adminClient> | null = null;
  let actorUserId: string | null = null;
  let actorEmail = "";
  let publicEmployeeAccess = false;
  let publicClientKey = "";
  let context: Awaited<ReturnType<typeof requireAppAdmin>> | null = null;
  try {
    const body = await request.json().catch(() => ({}));

    const requestedQuickHours = Number(body.quick_hours ?? 1);
    let quickHours = [1, 6, 24].includes(requestedQuickHours) ? requestedQuickHours : 1;
    let quickMessageLimit = quickHours === 24 ? 500 : quickHours === 6 ? 120 : 20;
    context = trustedContext ?? await requireAppAdmin(request);
    let banks = await workspaceBanks(context);
    operationClient = context.client;
    actorUserId = context.user.id;
    actorEmail = context.email;
    if (!operationClient) throw new Error("No se pudo establecer el contexto de sincronización.");
    const client = operationClient;
    const workspaceId = context.workspaceId;
    const now = new Date();
    const requestedMode = String(body.mode || "range").toLowerCase();
    let syncMode = publicEmployeeAccess || requestedMode === "quick" ? "quick" : "range";
    let quickStart = new Date(now.getTime() - quickHours * 60 * 60 * 1000);
    const defaultFrom = new Date(now.getTime() - 6 * 86400000);
    let dateFrom = syncMode === "quick"
      ? isoDay(quickStart.toISOString().slice(0, 10), quickStart)
      : isoDay(body.date_from, defaultFrom);
    let dateTo = syncMode === "quick" ? isoDay(now.toISOString().slice(0, 10), now) : isoDay(body.date_to, now);
    if (dateFrom > dateTo) throw new Error("La fecha inicial no puede ser posterior a la fecha final.");

    const {data:run,error:runError}=await client.rpc('claim_sync_batch',{p_workspace:workspaceId,p_user:actorUserId,p_kind:'movements',p_request:{mode:syncMode,banks,quick_hours:syncMode === "quick" ? quickHours : null,date_from:syncMode === "range" ? dateFrom : null,date_to:syncMode === "range" ? dateTo : null},p_run:body.resume_run_id ?? null});
    if(runError) throw new Error(runError.message);
    if(run.busy) return jsonResponse(request,{error:'Hay una sincronización pendiente en tu workspace. Puedes continuarla desde Configuración.',active_run_id:run.id},409);
    if(run.completed) return jsonResponse(request,{...run.state.detail,sync_run_id:run.id,status:run.state.stats?.errors?'partial':'success',has_more:false});
    syncRunId=Number(run.id);
    batch=new SyncBatch(client,syncRunId,run.lease,run.state || {});
    if(run.request) {
      banks=run.request.banks;syncMode=run.request.mode;
      quickHours=run.request.quick_hours || 1;quickMessageLimit=quickHours===24?500:quickHours===6?120:20;
    }
    if(batch.state.parameters) {
      dateFrom=String(batch.state.parameters.date_from);dateTo=String(batch.state.parameters.date_to);
      quickStart=new Date(String(batch.state.parameters.start_at));
    }


    const { data: connection, error: connectionError } = await client.from("gmail_connections")
      .select("google_email,refresh_token_ciphertext,refresh_token_iv,status")
      .eq("workspace_id", context!.workspaceId).eq("owner_user_id", actorUserId).maybeSingle();
    if (connectionError) throw new Error(`No se pudo consultar Gmail: ${connectionError.message}`);
    if (!connection || connection.status === "disconnected" || !connection.refresh_token_ciphertext || !connection.refresh_token_iv) {
      throw new Error("Gmail no tiene una conexión reutilizable. Ejecuta el verificador y, si es necesario, conecta la cuenta nuevamente.");
    }

    const refreshToken = await decryptSecret(connection.refresh_token_ciphertext, connection.refresh_token_iv);
    const token = await refreshGoogleAccessToken(refreshToken);
    const after = dateFrom.replaceAll("-", "/");
    const endExclusive = new Date(`${dateTo}T00:00:00-05:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const before = endExclusive.toISOString().slice(0, 10).replaceAll("-", "/");
    const senderFilter = bankQuery(banks);
    const proposedQueryText = syncMode === "quick"
      ? `${senderFilter} after:${Math.floor(quickStart.getTime() / 1000)}`
      : `${senderFilter} after:${after} before:${before}`;
    const queryText=String(batch.state.parameters?.query || proposedQueryText);
    batch.state.parameters ||= {query:queryText,date_from:dateFrom,date_to:dateTo,start_at:quickStart.toISOString()};
    const query = encodeURIComponent(queryText);
    const messageLimit = syncMode === "quick" ? quickMessageLimit : 500;

    let pageToken = batch.state.listing_page_token || "";
    const refs: Array<{ id: string; threadId?: string }> = [...(batch.state.refs || [])];
    if(!batch.state.listing_done) {
    do {
      const pageSize = syncMode === "quick" ? quickMessageLimit : 100;
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${pageSize}`);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await gmailJson<GmailListResponse>(url.toString(), token.access_token);
      refs.push(...(page.messages || []));
      pageToken = page.nextPageToken || "";
      batch.state.refs=refs;batch.state.listing_page_token=pageToken;
      if(pageToken && refs.length<messageLimit) {
        await batch.save(true);
        return jsonResponse(request,{sync_run_id:syncRunId,has_more:true,status:'running',processed:0,messages_found:refs.length});
      }
      if (refs.length >= messageLimit) break;
    } while (pageToken);
    if (refs.length > messageLimit) refs.splice(messageLimit);
    batch.state.refs=refs; batch.state.truncated=Boolean(pageToken); batch.state.offset=0;batch.state.listing_done=true;
    await batch.save();
    }
    refs.splice(0,refs.length,...(batch.state.refs || []));

    let messagesScanned = batch.state.stats?.messagesScanned || 0;
    let candidatesCreated = batch.state.stats?.candidatesCreated || 0;
    let candidateDuplicates = batch.state.stats?.candidateDuplicates || 0;
    let errors = batch.state.stats?.errors || 0;
    let bancolombiaEmails = batch.state.stats?.bancolombiaEmails || 0;
    let movementsCreated = batch.state.stats?.movementsCreated || 0;
    let movementDuplicates = batch.state.stats?.movementDuplicates || 0;
    let bancolombiaUnidentified = batch.state.stats?.bancolombiaUnidentified || 0;

    const batchStart=Date.now();
    const initialOffset=batch.state.offset || 0;
    for (const ref of refs.slice(initialOffset, initialOffset+5)) {
      if(Date.now()-batchStart>40000) break;
      try {
        const message = await gmailJson<GmailMessage>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          token.access_token
        );
        const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null;
        if (syncMode === "quick" && receivedAt && new Date(receivedAt).getTime() < new Date(String(batch.state.parameters?.start_at)).getTime()) continue;
        messagesScanned += 1;
        const fromHeader = header(message, "From");
        const bank = senderEmail(fromHeader) === "notificaciones@nequi.com.co" ? "nequi" : isBancolombiaNotification(fromHeader,header(message,"Subject")) ? "bancolombia" : null;
        if (!bank || !banks.includes(bank)) continue;
        batch.state.bankProgress ||= {};
        batch.state.bankProgress[bank] ||= {scanned:0,unrecognized:0,errors:0};
        batch.state.bankProgress[bank].scanned++;
        const extract = bank === "nequi" ? extractNequiMovement : extractBancolombiaMovement;
        const extractorVersion = bank === "nequi" ? "nequi-5E-v1" : BANCOLOMBIA_EXTRACTOR_VERSION;
        const baseMetadata = {
          date_header: header(message, "Date"),
          sender_email: senderEmail(fromHeader),
          phase_last_seen: "2B.3.4",
          sync_mode: syncMode,
          quick_hours: syncMode === "quick" ? quickHours : null
        };
        const candidateRow = { workspace_id: workspaceId,
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId || ref.threadId || null,
          sync_run_id: syncRunId,
          internal_date: receivedAt,
          sender: fromHeader,
          recipient: header(message, "To"),
          subject: header(message, "Subject"),
          snippet: message.snippet || "",
          labels: message.labelIds || [],
          raw_metadata: baseMetadata,
          last_detected_at: new Date().toISOString()
        };
        const { data: existingCandidate, error: existingCandidateError } = await client.from("gmail_sync_candidates").select("id,processing_status,raw_metadata").eq("workspace_id", workspaceId).eq("gmail_message_id", message.id).maybeSingle();
        if (existingCandidateError) throw existingCandidateError;
        const { error: saveCandidateError } = await client.from("gmail_sync_candidates").upsert({
          ...candidateRow,
          processing_status: existingCandidate?.processing_status || "candidate",
          raw_metadata: { ...(existingCandidate?.raw_metadata || {}), ...baseMetadata }
        }, { onConflict: "workspace_id,gmail_message_id" });
        if (saveCandidateError) throw saveCandidateError;
        if (existingCandidate) candidateDuplicates += 1; else candidatesCreated += 1;


        bancolombiaEmails += 1;

        try {
          const fullMessage = await gmailJson<GmailMessage>(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=full`,
            token.access_token
          );
          const content = await extractMessageText(fullMessage, token.access_token);
          const extraction = (bank === "nequi" || isBancolombiaSender(fromHeader)) ? extract({
            subject: header(fullMessage, "Subject") || header(message, "Subject"),
            text: content.text,
            snippet: fullMessage.snippet || message.snippet || "",
            receivedAt: receivedAt || new Date()
          }) : null;

          if (!extraction) {
            bancolombiaUnidentified += 1;
            batch.state.bankProgress[bank].unrecognized++;
            await client.from("gmail_sync_candidates").update({
              processing_status: "ignored",
              raw_metadata: {
                ...baseMetadata,
                source_detected: bank,
                extraction_result: "unsupported_notification",
                requires_review: true,
                unrecognized_reason: "No coincide con una regla de movimiento soportada.",
                notification_text: content.text || fullMessage.snippet || message.snippet || "",
                notification_snippet: fullMessage.snippet || message.snippet || "",
                registered_at: new Date().toISOString(),
                extractor_version: extractorVersion
              }
            }).eq("workspace_id", workspaceId).eq("gmail_message_id", message.id);
            continue;
          }

          const fingerprintSource = [
            bank,
            extraction.movement_type,
            extraction.transaction_date,
            extraction.amount_cop,
            extraction.detail.toLowerCase(),
            extraction.reference_text.toLowerCase()
          ].join("|");
          const fingerprint = await sha256Hex(fingerprintSource);
          const { data: existingMovement, error: existingMovementError } = await client.from("financial_movements")
            .select("id,source_metadata")
            .eq("workspace_id", workspaceId)
            .eq("workspace_id", workspaceId).eq("gmail_message_id", message.id)
            .eq("movement_type", extraction.movement_type)
            .maybeSingle();
          if (existingMovementError) throw existingMovementError;

          let movementResult = "movement_created";
          if (existingMovement) {
            // A write may have succeeded before the checkpoint response was lost.
            if (existingMovement.source_metadata?.sync_run_id === syncRunId) movementsCreated += 1;
            else movementDuplicates += 1;
            movementResult = "movement_refreshed";
            const { error: refreshMovementError } = await client.from("financial_movements").update({
              transaction_date: extraction.transaction_date,
              transaction_at: extraction.transaction_at,
              email_received_at: receivedAt,
              detail: extraction.detail,
              amount_cop: extraction.amount_cop,
              extraction_confidence: extraction.extraction_confidence,
              extractor_version: extractorVersion,
              reference_text: extraction.reference_text,
              source_metadata: {
                ...(existingMovement.source_metadata || {}),
                ...extraction.source_metadata,
                last_sync_run_id: syncRunId,
                refreshed_at: new Date().toISOString()
              }
            }).eq("id", existingMovement.id);
            if (refreshMovementError) throw refreshMovementError;
          } else {
            const { data: fingerprintMatch, error: fingerprintError } = extraction.reference_text ? await client.from("financial_movements")
              .select("id,gmail_message_id")
              .eq("workspace_id", workspaceId)
              .eq("raw_fingerprint", fingerprint)
              .neq("gmail_message_id", message.id)
              .limit(1)
              .maybeSingle() : {data:null,error:null};
            if (fingerprintError) throw fingerprintError;

            if (fingerprintMatch) {
              movementDuplicates += 1;
              movementResult = "movement_duplicate_ignored";
            } else {
              const { error: movementError } = await client.from("financial_movements").insert({
                workspace_id: workspaceId,
                gmail_message_id: message.id,
                gmail_thread_id: fullMessage.threadId || message.threadId || ref.threadId || null,
                source: bank,
                movement_type: extraction.movement_type,
                transaction_date: extraction.transaction_date,
                transaction_at: extraction.transaction_at,
                email_received_at: receivedAt,
                detail: extraction.detail,
                amount_cop: extraction.amount_cop,
                sender_email: senderEmail(fromHeader),
                email_subject: header(fullMessage, "Subject") || header(message, "Subject"),
                extraction_confidence: extraction.extraction_confidence,
                extractor_version: extractorVersion,
                raw_fingerprint: fingerprint,
                reference_text: extraction.reference_text,
                source_metadata: {
                  ...extraction.source_metadata,
                  sync_run_id: syncRunId
                }
              });
              if (movementError) throw movementError;
              movementsCreated += 1;
            }
          }

          await client.from("gmail_sync_candidates").update({
            processing_status: "processed",
            raw_metadata: {
              ...baseMetadata,
              source_detected: bank,
              extraction_result: movementResult,
              movement_type: extraction.movement_type,
              extractor_version: extractorVersion
            }
          }).eq("workspace_id", workspaceId).eq("gmail_message_id", message.id);
        } catch (extractionError) {
          errors += 1;
          batch.state.bankProgress[bank].errors++;
          await client.from("gmail_sync_candidates").update({
            processing_status: "error",
            raw_metadata: { ...baseMetadata, source_detected: bank, extraction_result: "error", requires_review: true, registered_at: new Date().toISOString(), extractor_version: extractorVersion, error: errorMessage(extractionError) }
          }).eq("workspace_id", workspaceId).eq("gmail_message_id", message.id);
          await client.from("processing_errors").insert({ workspace_id: context!.workspaceId,
            sync_run_id: syncRunId,
            gmail_message_id: ref.id,
            source: bank,
            stage: "movement_extraction",
            error_message: errorMessage(extractionError),
            technical_detail: { phase: "3A.3", extractor_version: "multi-bank-5E-v1" }
          });
        }
      } catch (itemError) {
        errors += 1;
        await client.from("processing_errors").insert({ workspace_id: context!.workspaceId,
          sync_run_id: syncRunId,
          gmail_message_id: ref.id,
          source: "gmail",
          stage: "metadata",
          error_message: errorMessage(itemError),
          technical_detail: { phase: "3A.3" }
        });
      } finally {
        batch.state.offset=(batch.state.offset || 0)+1;
        batch.state.stats={messagesScanned,candidatesCreated,candidateDuplicates,errors,bancolombiaEmails,movementsCreated,movementDuplicates,bancolombiaUnidentified};
        await batch.save();
      }
    }

    if((batch.state.offset || 0)<refs.length) {
      batch.state.last_error=null;
      await batch.save(true);
      return jsonResponse(request,{sync_run_id:syncRunId,has_more:true,status:'running',processed:batch.state.offset,messages_found:refs.length,bank_progress:batch.state.bankProgress});
    }

    const status = errors ? "partial" : "success";
    const finishedAt = new Date().toISOString();
    const detail = {
      phase: publicEmployeeAccess ? "3A.3-public" : "3A.3",
      banks,
      mode: syncMode,
      quick_hours: syncMode === "quick" ? quickHours : null,
      start_at: syncMode === "quick" ? quickStart.toISOString() : null,
      date_from: dateFrom,
      date_to: dateTo,
      messages_found: refs.length,
      candidates_created: candidatesCreated,
      candidate_duplicates: candidateDuplicates,
      bancolombia_emails: bancolombiaEmails,
      movements_created: movementsCreated,
      movement_duplicates: movementDuplicates,
      bancolombia_unidentified: bancolombiaUnidentified,
      extractor_version: "multi-bank-5E-v1",
      limited_to: messageLimit,
      quick_message_limit: syncMode === "quick" ? quickMessageLimit : null
    };
    batch.state.detail={...detail,messages_scanned:messagesScanned,errors_count:errors,duplicates_ignored:movementDuplicates,truncated:batch.state.truncated};
    batch.state.last_error=null;
    await batch.save(true,true);
    await client.from("gmail_connections").update({
      status: "connected",
      last_verified_at: finishedAt,
      last_sync_at: finishedAt,
      last_error: errors ? `${errors} correo(s) presentaron errores de lectura. Consulta el diagnóstico para ver el detalle.` : null
    }).eq("workspace_id", context!.workspaceId).eq("owner_user_id", actorUserId);
    await client.from("gmail_integration_audit").insert({ workspace_id: context!.workspaceId,
      event_type: publicEmployeeAccess ? "employee_public_sync" : "manual_sync",
      user_id: actorUserId,
      user_email: actorEmail,
      google_email: connection.google_email,
      detail: { sync_run_id: syncRunId, ...detail, errors, public_employee_access: publicEmployeeAccess }
    });

    return jsonResponse(request, {
      sync_run_id: syncRunId,
      has_more:false,
      truncated:batch.state.truncated,
      bank_progress:batch.state.bankProgress,
      status,
      banks,
      mode: syncMode,
      quick_hours: syncMode === "quick" ? quickHours : null,
      start_at: syncMode === "quick" ? quickStart.toISOString() : null,
      date_from: dateFrom,
      date_to: dateTo,
      messages_found: refs.length,
      messages_scanned: messagesScanned,
      candidates_created: candidatesCreated,
      candidate_duplicates: candidateDuplicates,
      bancolombia_emails: bancolombiaEmails,
      movements_created: movementsCreated,
      movement_duplicates: movementDuplicates,
      bancolombia_unidentified: bancolombiaUnidentified,
      duplicates_ignored: movementDuplicates,
      errors_count: errors,
      quick_message_limit: syncMode === "quick" ? quickMessageLimit : null
    });
  } catch (error) {
    if(batch) {
      try { batch.state.last_error=errorMessage(error); await batch.save(true); } catch { /* A later claim can recover the expired lease. */ }
    }
    return jsonResponse(request,{error:errorMessage(error),sync_run_id:syncRunId,recoverable:Boolean(batch)},400);
  }
}