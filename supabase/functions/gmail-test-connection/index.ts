import { optionsResponse } from "../_shared/cors.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { getGmailProfile, refreshGoogleAccessToken } from "../_shared/google.ts";
import { jsonResponse, errorMessage } from "../_shared/http.ts";
import { requireAppAdmin } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse(request, { error: "Método no permitido." }, 405);

  try {
    const admin = await requireAppAdmin(request);
    const { client, user, email } = admin;
    const { data: connection, error } = await client
      .from("gmail_connections")
      .select("google_email,refresh_token_ciphertext,refresh_token_iv,status")
      .eq("owner_user_id", admin.user.id)
      .maybeSingle();
    if (error) throw new Error(`No se pudo consultar la conexión: ${error.message}`);
    if (!connection || connection.status !== "connected") throw new Error("No hay una cuenta de Gmail conectada.");
    if (!connection.refresh_token_ciphertext || !connection.refresh_token_iv) throw new Error("La conexión no tiene credenciales reutilizables.");

    const refreshToken = await decryptSecret(connection.refresh_token_ciphertext, connection.refresh_token_iv);
    const tokens = await refreshGoogleAccessToken(refreshToken);
    const profile = await getGmailProfile(tokens.access_token);
    const verifiedAt = new Date().toISOString();

    await client.from("gmail_connections").update({
      google_email: profile.emailAddress,
      google_history_id: profile.historyId || null,
      status: "connected",
      last_verified_at: verifiedAt,
      last_error: null
    }).eq("owner_user_id", admin.user.id);

    await client.from("gmail_integration_audit").insert({
      event_type: "connection_test_ok",
      user_id: user.id,
      user_email: email,
      google_email: profile.emailAddress,
      detail: { messages_total: profile.messagesTotal || 0, threads_total: profile.threadsTotal || 0 }
    });

    return jsonResponse(request, { ok: true, google_email: profile.emailAddress, verified_at: verifiedAt });
  } catch (error) {
    const detail = errorMessage(error);
    try {
      const admin = await requireAppAdmin(request);
    const { client, user, email } = admin;
      await client.from("gmail_connections").update({ status: "error", last_error: detail }).eq("owner_user_id", admin.user.id);
      await client.from("gmail_integration_audit").insert({ event_type: "connection_test_error", user_id: user.id, user_email: email, detail: { error: detail } });
    } catch {
      // Conserva el error original.
    }
    return jsonResponse(request, { error: detail }, 400);
  }
});




