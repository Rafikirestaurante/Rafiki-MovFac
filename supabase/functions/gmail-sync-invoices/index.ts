import { unzipSync } from "npm:fflate@0.8.2";
import { optionsResponse } from "../_shared/cors.ts";
import { jsonResponse, errorMessage } from "../_shared/http.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { refreshGoogleAccessToken } from "../_shared/google.ts";
import { requireAppAdmin } from "../_shared/supabase.ts";
import {
  ELECTRONIC_INVOICE_EXTRACTOR_VERSION,
  guessInvoiceFromEmail,
  parseElectronicInvoiceXml,
  type ParsedElectronicInvoice
} from "../_shared/electronicInvoice.ts";

type GmailListResponse = { messages?: Array<{ id: string; threadId?: string }>; nextPageToken?: string };
type GmailBody = { size?: number; data?: string; attachmentId?: string };
type GmailPart = { mimeType?: string; filename?: string; body?: GmailBody; parts?: GmailPart[] };
type GmailMessage = { id: string; threadId?: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: GmailPart & { headers?: Array<{ name: string; value: string }> } };
type GmailAttachment = { data?: string; size?: number };
type AttachmentRef = { filename: string; mimeType: string; attachmentId: string; inlineData: string };

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 30 * 1024 * 1024;

function isoDay(value: unknown, fallback: Date): string {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback.toISOString().slice(0, 10);
}
function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || "";
}
async function gmailJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gmail respondió: ${String(data.error?.message || response.statusText)}`);
  return data as T;
}
function decodeBase64UrlBytes(data: string): Uint8Array {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function attachmentBytes(messageId: string, attachment: AttachmentRef, token: string): Promise<Uint8Array> {
  if (attachment.inlineData) return decodeBase64UrlBytes(attachment.inlineData);
  if (!attachment.attachmentId) return new Uint8Array();
  const payload = await gmailJson<GmailAttachment>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.attachmentId)}`, token);
  return payload.data ? decodeBase64UrlBytes(payload.data) : new Uint8Array();
}
function collectAttachments(message: GmailMessage): AttachmentRef[] {
  const rows: AttachmentRef[] = [];
  function walk(part?: GmailPart): void {
    if (!part) return;
    const filename = String(part.filename || "").trim();
    const mimeType = String(part.mimeType || "application/octet-stream").toLowerCase();
    if (filename && (part.body?.attachmentId || part.body?.data)) rows.push({ filename, mimeType, attachmentId: part.body?.attachmentId || "", inlineData: part.body?.data || "" });
    for (const child of part.parts || []) walk(child);
  }
  walk(message.payload);
  return rows;
}
async function messageText(message: GmailMessage, token: string): Promise<string> {
  const values: string[] = [];
  async function walk(part?: GmailPart): Promise<void> {
    if (!part) return;
    const mime = String(part.mimeType || "").toLowerCase();
    if ((mime === "text/plain" || mime === "text/html") && (part.body?.data || part.body?.attachmentId)) {
      const bytes = await attachmentBytes(message.id, { filename: "", mimeType: mime, attachmentId: part.body?.attachmentId || "", inlineData: part.body?.data || "" }, token);
      const text = new TextDecoder().decode(bytes).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
      if (text) values.push(text);
    }
    for (const child of part.parts || []) await walk(child);
  }
  await walk(message.payload);
  return values.join(" ") || message.snippet || "";
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}
function fileType(filename: string, mimeType: string): "zip" | "xml" | "pdf" | "other" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip") || mimeType.includes("zip")) return "zip";
  if (lower.endsWith(".xml") || mimeType.includes("xml")) return "xml";
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";
  return "other";
}

Deno.serve(async (request: Request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse(request, { error: "Método no permitido." }, 405);

  let syncRunId: number | null = null;
  let operationContext: Awaited<ReturnType<typeof requireAppAdmin>> | null = null;
  try {
    const admin = await requireAppAdmin(request);
    operationContext = admin;
    const client = admin.client;
    const workspace = {id:admin.workspaceId};
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const mode = String(body.mode || "recent") === "range" ? "range" : "recent";
    const recentStart = new Date(now.getTime() - 7 * 86400000);
    const dateFrom = mode === "recent" ? recentStart.toISOString().slice(0, 10) : isoDay(body.date_from, recentStart);
    const dateTo = mode === "recent" ? now.toISOString().slice(0, 10) : isoDay(body.date_to, now);
    if (dateFrom > dateTo) throw new Error("La fecha inicial no puede ser posterior a la fecha final.");

    const {data:run,error:runError} = await client.rpc("begin_workspace_sync",{p_workspace:admin.workspaceId,p_user:admin.user.id,p_detail:{phase:"2D",mode,date_from:dateFrom,date_to:dateTo}});
    if (runError) throw new Error(`No se pudo iniciar la sincronización: ${runError.message}`);
    if (run.busy) return jsonResponse(request,{error:"Ya existe una sincronización en curso en tu workspace.",active_run_id:run.id},409);
    syncRunId = Number(run.id);

    const { data: connection, error: connectionError } = await client.from("gmail_connections").select("google_email,refresh_token_ciphertext,refresh_token_iv,status").eq("workspace_id", admin.workspaceId).eq("owner_user_id", admin.user.id).maybeSingle();
    if (connectionError) throw new Error(connectionError.message);
    if (!connection || connection.status === "disconnected" || !connection.refresh_token_ciphertext || !connection.refresh_token_iv) throw new Error("Gmail no tiene una conexión reutilizable.");
    const refreshToken = await decryptSecret(connection.refresh_token_ciphertext, connection.refresh_token_iv);
    const token = await refreshGoogleAccessToken(refreshToken);

    const endExclusive = new Date(`${dateTo}T00:00:00-05:00`); endExclusive.setDate(endExclusive.getDate() + 1);
    const queryText = `has:attachment {filename:xml filename:zip filename:pdf} after:${dateFrom.replaceAll("-", "/")} before:${endExclusive.toISOString().slice(0, 10).replaceAll("-", "/")}`;
    const refs: Array<{ id: string; threadId?: string }> = [];
    let pageToken = "";
    do {
      const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      url.searchParams.set("q", queryText);
      url.searchParams.set("maxResults", "50");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await gmailJson<GmailListResponse>(url.toString(), token.access_token);
      refs.push(...(page.messages || []));
      pageToken = page.nextPageToken || "";
      if (refs.length >= 150) break;
    } while (pageToken);
    if (refs.length > 150) refs.splice(150);

    let messagesScanned = 0, attachmentsScanned = 0, xmlDocuments = 0, pdfFallbacks = 0, invoicesCreated = 0, invoicesUpdated = 0, duplicates = 0, incomplete = 0, errors = 0;

    for (const ref of refs) {
      try {
        const message = await gmailJson<GmailMessage>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=full`, token.access_token);
        messagesScanned += 1;
        const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
        const from = header(message, "From");
        const subject = header(message, "Subject");
        const attachments = collectAttachments(message).filter((item) => fileType(item.filename, item.mimeType) !== "other");
        const text = await messageText(message, token.access_token);
        const extracted: Array<{ parsed: ParsedElectronicInvoice; attachment: AttachmentRef; sourceFileType: string; sourceEntry?: string }> = [];
        const pdfAttachments: AttachmentRef[] = [];

        for (const attachment of attachments) {
          attachmentsScanned += 1;
          const kind = fileType(attachment.filename, attachment.mimeType);
          if (kind === "pdf") { pdfAttachments.push(attachment); continue; }
          const bytes = await attachmentBytes(message.id, attachment, token.access_token);
          if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error(`El adjunto ${attachment.filename} supera el límite de 15 MB.`);
          if (kind === "xml") {
            const parsed = parseElectronicInvoiceXml(new TextDecoder().decode(bytes));
            if (parsed) { extracted.push({ parsed, attachment, sourceFileType: "xml" }); xmlDocuments += 1; }
          } else if (kind === "zip") {
            const files = unzipSync(bytes);
            let expanded = 0;
            for (const [entryName, entryBytes] of Object.entries(files)) {
              expanded += entryBytes.byteLength;
              if (expanded > MAX_UNZIPPED_BYTES) throw new Error(`El ZIP ${attachment.filename} supera el límite descomprimido de 30 MB.`);
              if (!entryName.toLowerCase().endsWith(".xml")) continue;
              const parsed = parseElectronicInvoiceXml(new TextDecoder().decode(entryBytes));
              if (parsed) { extracted.push({ parsed, attachment, sourceFileType: "zip", sourceEntry: entryName }); xmlDocuments += 1; }
            }
          }
        }

        if (!extracted.length) {
          for (const pdf of pdfAttachments) {
            extracted.push({ parsed: guessInvoiceFromEmail({ subject, text, filename: pdf.filename, from, receivedAt }), attachment: pdf, sourceFileType: "pdf" });
            pdfFallbacks += 1;
          }
        }

        if (!extracted.length) continue;
        for (const item of extracted) {
          const parsed = item.parsed;
          const documentKey = await sha256Hex([message.id, item.attachment.filename, item.sourceEntry || "", parsed.cufe || parsed.supplier_tax_id, parsed.invoice_number || "unknown"].join("|"));
          let existing: { id: string } | null = null;
          if (parsed.cufe) {
            const { data,error:dedupError } = await client.from("electronic_invoices").select("id").eq("workspace_id", workspace.id).eq("cufe", parsed.cufe).limit(1).maybeSingle(); if(dedupError) throw dedupError; existing = data;
          }
          if (!existing && parsed.supplier_tax_id && parsed.invoice_number) {
            const { data,error:dedupError } = await client.from("electronic_invoices").select("id").eq("workspace_id", workspace.id).eq("supplier_tax_id", parsed.supplier_tax_id).eq("invoice_number", parsed.invoice_number).limit(1).maybeSingle(); if(dedupError) throw dedupError; existing = data;
          }
          if (!existing) {
            const { data,error:dedupError } = await client.from("electronic_invoices").select("id").eq("workspace_id", workspace.id).eq("document_key", documentKey).limit(1).maybeSingle(); if(dedupError) throw dedupError; existing = data;
          }
          const row = {
            workspace_id: admin.workspaceId, gmail_message_id: message.id,
            gmail_thread_id: message.threadId || ref.threadId || null,
            attachment_id: item.attachment.attachmentId || null,
            document_type: parsed.document_type,
            invoice_date: parsed.invoice_date,
            due_date: parsed.due_date,
            supplier_name: parsed.supplier_name,
            supplier_tax_id: parsed.supplier_tax_id,
            invoice_number: parsed.invoice_number,
            cufe: parsed.cufe || null,
            currency: parsed.currency,
            subtotal_cop: parsed.subtotal_cop,
            tax_cop: parsed.tax_cop,
            total_cop: parsed.total_cop,
            attachment_name: item.attachment.filename,
            attachment_mime_type: item.attachment.mimeType,
            source_file_type: item.sourceFileType,
            document_status: parsed.document_status,
            extractor_version: ELECTRONIC_INVOICE_EXTRACTOR_VERSION,
            xml_fingerprint: item.sourceFileType === "pdf" ? null : documentKey,
            document_key: documentKey,
            sender_email: from,
            email_subject: subject,
            email_received_at: receivedAt,
            source_metadata: { ...parsed.source_metadata, zip_entry: item.sourceEntry || null, extraction_confidence: parsed.extraction_confidence, sync_run_id: syncRunId }
          };
          if (existing) {
            const { error } = await client.from("electronic_invoices").update(row).eq("workspace_id",admin.workspaceId).eq("id", existing.id);
            if (error) throw error;
            invoicesUpdated += 1; duplicates += 1;
          } else {
            const { error } = await client.from("electronic_invoices").insert({ ...row, workspace_id: workspace.id });
            if (error) throw error;
            invoicesCreated += 1;
          }
          if (parsed.document_status === "incomplete") incomplete += 1;
        }

        const {error:candidateError} = await client.from("gmail_sync_candidates").upsert({
          workspace_id: admin.workspaceId, gmail_message_id: message.id, gmail_thread_id: message.threadId || ref.threadId || null, sync_run_id: syncRunId,
          internal_date: receivedAt, sender: from, recipient: header(message, "To"), subject, snippet: message.snippet || "", labels: message.labelIds || [],
          processing_status: "processed", raw_metadata: { phase_last_seen: "2D", source_detected: "electronic_invoice", attachments_scanned: attachments.length, invoices_detected: extracted.length, extractor_version: ELECTRONIC_INVOICE_EXTRACTOR_VERSION }, last_detected_at: new Date().toISOString()
        }, { onConflict: "workspace_id,gmail_message_id" });
        if(candidateError) throw candidateError;
      } catch (itemError) {
        errors += 1;
        await client.from("processing_errors").insert({ workspace_id: admin.workspaceId, sync_run_id: syncRunId, gmail_message_id: ref.id, source: "invoice", stage: "invoice_extraction", error_message: errorMessage(itemError), technical_detail: { phase: "2D", extractor_version: ELECTRONIC_INVOICE_EXTRACTOR_VERSION } });
      }
    }

    const status = errors ? (invoicesCreated || invoicesUpdated ? "partial" : "error") : "success";
    const detail = { phase: "2D", mode, date_from: dateFrom, date_to: dateTo, messages_found: refs.length, attachments_scanned: attachmentsScanned, xml_documents: xmlDocuments, pdf_fallbacks: pdfFallbacks, invoices_created: invoicesCreated, invoices_updated: invoicesUpdated, duplicates_ignored: duplicates, incomplete_documents: incomplete, extractor_version: ELECTRONIC_INVOICE_EXTRACTOR_VERSION };
    const finishedAt = new Date().toISOString();
    await client.from("gmail_sync_runs").update({ status, finished_at: finishedAt, messages_scanned: messagesScanned, invoices_created: invoicesCreated, duplicates_ignored: duplicates, errors_count: errors, detail }).eq("id", syncRunId);
    await client.from("gmail_connections").update({ status: "connected", last_verified_at: finishedAt, last_sync_at: finishedAt, last_error: errors ? `${errors} correo(s) de facturación presentaron errores.` : null }).eq("workspace_id", admin.workspaceId).eq("owner_user_id", admin.user.id);
    await client.from("gmail_integration_audit").insert({ workspace_id: admin.workspaceId, event_type: "invoice_sync", user_id: admin.user.id, user_email: admin.email, google_email: connection.google_email, detail: { sync_run_id: syncRunId, ...detail, errors } });
    return jsonResponse(request, { sync_run_id: syncRunId, status, messages_found: refs.length, messages_scanned: messagesScanned, attachments_scanned: attachmentsScanned, xml_documents: xmlDocuments, pdf_fallbacks: pdfFallbacks, invoices_created: invoicesCreated, invoices_updated: invoicesUpdated, duplicates_ignored: duplicates, incomplete_documents: incomplete, errors_count: errors });
  } catch (error) {
    if (syncRunId) {
      try {
        const admin = operationContext;
        if (!admin) throw new Error("Contexto no disponible");
        await admin.client.from("gmail_sync_runs").update({ status: "error", finished_at: new Date().toISOString(), errors_count: 1, detail: { phase: "2D", fatal_error: errorMessage(error) } }).eq("id", syncRunId);
      } catch { /* conservar error original */ }
    }
    return jsonResponse(request, { error: errorMessage(error), sync_run_id: syncRunId }, 400);
  }
});




