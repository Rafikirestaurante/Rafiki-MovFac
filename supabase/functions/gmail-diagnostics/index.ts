import { optionsResponse } from "../_shared/cors.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { getGmailProfile, refreshGoogleAccessToken } from "../_shared/google.ts";
import { jsonResponse, errorMessage } from "../_shared/http.ts";
import { requireAppAdmin } from "../_shared/supabase.ts";

type Check = {
  key: string;
  label: string;
  ok: boolean;
  message: string;
  error?: string;
};

type GmailListResponse = {
  messages?: Array<{ id: string }>;
  resultSizeEstimate?: number;
};

import { selectedBanks, bankQuery } from "../_shared/banks.ts";

function friendlyError(value: unknown): string {
  const detail = errorMessage(value);
  const normalized = detail.toLowerCase();
  if (normalized.includes("invalid_grant")) return "Google rechazó la autorización guardada. La cuenta debe conectarse nuevamente.";
  if (normalized.includes("invalid_client")) return "Google rechazó el Client ID o el Client Secret configurado en Supabase.";
  if (normalized.includes("insufficient") || normalized.includes("permission") || normalized.includes("403")) return "La autorización no tiene permisos suficientes o Gmail API no está habilitada en Google Cloud.";
  if (normalized.includes("decrypt") || normalized.includes("descif")) return "No fue posible descifrar la credencial. Verifica que GMAIL_TOKEN_ENCRYPTION_KEY no haya cambiado.";
  if (normalized.includes("fetch") || normalized.includes("network") || normalized.includes("conex")) return "No fue posible comunicarse con Google en este momento.";
  return detail;
}

async function gmailSearch(accessToken: string, banks: string[]): Promise<GmailListResponse> {
  const query = encodeURIComponent(`${bankQuery(banks)} newer_than:30d`);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=1`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gmail respondió: ${String(data.error?.message || response.statusText)}`);
  return data as GmailListResponse;
}

Deno.serve(async (request: Request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse(request, { error: "Método no permitido." }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const banks = selectedBanks(body.banks);
    const admin = await requireAppAdmin(request);
    const { client, user, email } = admin;
    const checks: Check[] = [];
    const checkedAt = new Date().toISOString();

    const [{ data: recentErrors }, { data: recentCandidates }] = await Promise.all([
      client
        .from("processing_errors")
        .select("id,sync_run_id,gmail_message_id,source,stage,error_message,technical_detail,resolved,created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      client
        .from("gmail_sync_candidates")
        .select("id,gmail_message_id,internal_date,sender,subject,snippet,processing_status,raw_metadata,last_detected_at")
        .order("last_detected_at", { ascending: false })
        .limit(40)
    ]);
    const unrecognizedAlerts = (recentCandidates || [])
      .filter((item) => banks.includes(item.raw_metadata?.source_detected) && item.raw_metadata?.extraction_result === "unsupported_notification")
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        gmail_message_id: item.gmail_message_id,
        received_at: item.internal_date || item.last_detected_at,
        sender: item.sender,
        subject: item.subject,
        snippet: item.snippet
      }));

    const { data: connection, error: connectionError } = await client
      .from("gmail_connections")
      .select("google_email,status,connected_at,last_verified_at,last_sync_at,last_error,granted_scope,refresh_token_ciphertext,refresh_token_iv")
      .eq("owner_user_id", admin.user.id)
      .maybeSingle();

    if (connectionError) {
      const message = friendlyError(connectionError);
      checks.push({ key: "database", label: "Registro de conexión", ok: false, message: "No se pudo consultar la conexión guardada.", error: message });
      return jsonResponse(request, { ok: false, checked_at: checkedAt, checks, recent_errors: recentErrors || [], unrecognized_alerts: unrecognizedAlerts, summary_error: message });
    }

    if (!connection) {
      checks.push({ key: "connection", label: "Cuenta conectada", ok: false, message: "No existe una cuenta de Gmail conectada." });
      return jsonResponse(request, { ok: false, checked_at: checkedAt, checks, recent_errors: recentErrors || [], unrecognized_alerts: unrecognizedAlerts, summary_error: "Debes conectar una cuenta de Gmail." });
    }

    checks.push({
      key: "connection",
      label: "Cuenta conectada",
      ok: connection.status !== "disconnected",
      message: connection.status !== "disconnected" ? `Cuenta registrada: ${connection.google_email}.` : "La cuenta aparece desconectada."
    });

    if (!connection.refresh_token_ciphertext || !connection.refresh_token_iv) {
      const message = "La conexión no contiene una credencial reutilizable. Debes conectar Gmail nuevamente.";
      checks.push({ key: "credentials", label: "Credencial guardada", ok: false, message });
      await client.from("gmail_connections").update({ status: "error", last_error: message }).eq("owner_user_id", admin.user.id);
      return jsonResponse(request, { ok: false, checked_at: checkedAt, google_email: connection.google_email, checks, recent_errors: recentErrors || [], unrecognized_alerts: unrecognizedAlerts, summary_error: message });
    }
    checks.push({ key: "credentials", label: "Credencial guardada", ok: true, message: "La credencial cifrada está disponible." });

    let refreshToken = "";
    try {
      refreshToken = await decryptSecret(connection.refresh_token_ciphertext, connection.refresh_token_iv);
      checks.push({ key: "decryption", label: "Descifrado seguro", ok: true, message: "La credencial pudo descifrarse correctamente." });
    } catch (error) {
      const message = friendlyError(error);
      checks.push({ key: "decryption", label: "Descifrado seguro", ok: false, message: "No se pudo descifrar la credencial.", error: message });
      await client.from("gmail_connections").update({ status: "error", last_error: message }).eq("owner_user_id", admin.user.id);
      await client.from("gmail_integration_audit").insert({ event_type: "diagnostic_error", user_id: user.id, user_email: email, google_email: connection.google_email, detail: { stage: "decryption", error: message } });
      return jsonResponse(request, { ok: false, checked_at: checkedAt, google_email: connection.google_email, checks, recent_errors: recentErrors || [], unrecognized_alerts: unrecognizedAlerts, summary_error: message });
    }

    let accessToken = "";
    try {
      const tokens = await refreshGoogleAccessToken(refreshToken);
      accessToken = tokens.access_token;
      checks.push({ key: "token", label: "Autorización de Google", ok: true, message: "Google renovó el acceso correctamente." });
    } catch (error) {
      const message = friendlyError(error);
      checks.push({ key: "token", label: "Autorización de Google", ok: false, message: "Google no pudo renovar el acceso.", error: message });
      await client.from("gmail_connections").update({ status: "error", last_error: message }).eq("owner_user_id", admin.user.id);
      await client.from("gmail_integration_audit").insert({ event_type: "diagnostic_error", user_id: user.id, user_email: email, google_email: connection.google_email, detail: { stage: "token_refresh", error: message } });
      return jsonResponse(request, { ok: false, checked_at: checkedAt, google_email: connection.google_email, checks, recent_errors: recentErrors || [], unrecognized_alerts: unrecognizedAlerts, summary_error: message });
    }

    try {
      const profile = await getGmailProfile(accessToken);
      checks.push({ key: "profile", label: "Lectura de Gmail", ok: true, message: `Gmail respondió para ${profile.emailAddress}.` });
      connection.google_email = profile.emailAddress;
    } catch (error) {
      const message = friendlyError(error);
      checks.push({ key: "profile", label: "Lectura de Gmail", ok: false, message: "No fue posible consultar el buzón.", error: message });
      await client.from("gmail_connections").update({ status: "error", last_error: message }).eq("owner_user_id", admin.user.id);
      await client.from("gmail_integration_audit").insert({ event_type: "diagnostic_error", user_id: user.id, user_email: email, google_email: connection.google_email, detail: { stage: "gmail_profile", error: message } });
      return jsonResponse(request, { ok: false, checked_at: checkedAt, google_email: connection.google_email, checks, recent_errors: recentErrors || [], unrecognized_alerts: unrecognizedAlerts, summary_error: message });
    }

    try {
      const search = await gmailSearch(accessToken, banks);
      checks.push({
        key: "search",
        label: "Búsqueda de alertas de bancos seleccionados",
        ok: true,
        message: search.messages?.length ? "La búsqueda funciona y encontró al menos una alerta reciente." : "La búsqueda funciona, aunque no encontró alertas en los últimos 30 días."
      });
    } catch (error) {
      const message = friendlyError(error);
      checks.push({ key: "search", label: "Búsqueda de alertas de bancos seleccionados", ok: false, message: "Gmail respondió, pero la búsqueda de mensajes falló.", error: message });
      await client.from("gmail_connections").update({ status: "error", last_error: message }).eq("owner_user_id", admin.user.id);
      await client.from("gmail_integration_audit").insert({ event_type: "diagnostic_error", user_id: user.id, user_email: email, google_email: connection.google_email, detail: { stage: "gmail_search", error: message } });
      return jsonResponse(request, { ok: false, checked_at: checkedAt, google_email: connection.google_email, checks, recent_errors: recentErrors || [], unrecognized_alerts: unrecognizedAlerts, summary_error: message });
    }

    await client.from("gmail_connections").update({
      google_email: connection.google_email,
      status: "connected",
      last_verified_at: checkedAt,
      last_error: null
    }).eq("owner_user_id", admin.user.id);

    await client.from("gmail_integration_audit").insert({
      event_type: "diagnostic_ok",
      user_id: user.id,
      user_email: email,
      google_email: connection.google_email,
      detail: { checks: checks.map((item) => ({ key: item.key, ok: item.ok })) }
    });

    return jsonResponse(request, {
      ok: true,
      checked_at: checkedAt,
      google_email: connection.google_email,
      checks,
      recent_errors: recentErrors || [],
      unrecognized_alerts: unrecognizedAlerts,
      summary_error: null
    });
  } catch (error) {
    return jsonResponse(request, { error: friendlyError(error) }, 403);
  }
});




