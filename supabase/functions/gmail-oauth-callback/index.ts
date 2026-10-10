import { appRedirectUrl } from "../_shared/env.ts";
import { encryptSecret, sha256 } from "../_shared/crypto.ts";
import { exchangeAuthorizationCode, getGmailProfile } from "../_shared/google.ts";
import { adminClient } from "../_shared/supabase.ts";
import { errorMessage } from "../_shared/http.ts";

function redirectSafely(result: "connected" | "error", detail = ""): Response {
  try {
    return Response.redirect(appRedirectUrl(result, detail), 302);
  } catch {
    return new Response(result === "connected" ? "Gmail conectado." : `Error conectando Gmail: ${detail}`, {
      status: result === "connected" ? 200 : 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") return new Response("Método no permitido.", { status: 405 });

  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error") || "";
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (oauthError) return redirectSafely("error", `Google canceló la autorización: ${oauthError}`);
  if (!code || !state) return redirectSafely("error", "La respuesta de Google llegó incompleta.");

  const client = adminClient();
  let stateRow: { user_id: string; user_email: string } | null = null;
  try {
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("gmail_oauth_states")
      .update({ used_at: now })
      .eq("state_hash", await sha256(state))
      .is("used_at", null)
      .gt("expires_at", now)
      .select("user_id,user_email")
      .maybeSingle();
    if (error) throw new Error(`No se pudo validar la autorización: ${error.message}`);
    if (!data) throw new Error("La autorización venció, ya fue usada o no pertenece a esta aplicación.");
    stateRow = data;

    const tokens = await exchangeAuthorizationCode(code);
    if (!tokens.access_token) throw new Error("Google no devolvió un access token válido.");
    if (!tokens.refresh_token) throw new Error("Google no devolvió el refresh token. Retira el acceso previo en Google y vuelve a conectar.");

    const profile = await getGmailProfile(tokens.access_token);
    const encrypted = await encryptSecret(tokens.refresh_token);
    const connectedAt = new Date().toISOString();

    const { error: connectionError } = await client.from("gmail_connections").upsert({
      connection_key: "principal",
      owner_user_id: stateRow.user_id,
      google_email: profile.emailAddress,
      google_history_id: profile.historyId || null,
      refresh_token_ciphertext: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      granted_scope: tokens.scope || "",
      token_type: tokens.token_type || "Bearer",
      status: "connected",
      connected_at: connectedAt,
      last_verified_at: connectedAt,
      last_error: null,
      disconnected_at: null
    }, { onConflict: "workspace_id" });
    if (connectionError) throw new Error(`No se pudo guardar la conexión: ${connectionError.message}`);

    await client.from("gmail_integration_audit").insert({
      event_type: "oauth_connected",
      user_id: stateRow.user_id,
      user_email: stateRow.user_email,
      google_email: profile.emailAddress,
      detail: { scope: tokens.scope || "", messages_total: profile.messagesTotal || 0, threads_total: profile.threadsTotal || 0 }
    });

    return redirectSafely("connected");
  } catch (error) {
    const detail = errorMessage(error);
    try {
      await client.from("gmail_integration_audit").insert({
        event_type: "oauth_error",
        user_id: stateRow?.user_id || null,
        user_email: stateRow?.user_email || null,
        detail: { error: detail }
      });
    } catch {
      // El callback debe regresar a la app aunque la auditoría secundaria falle.
    }
    return redirectSafely("error", detail);
  }
});





