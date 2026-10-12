import { optionsResponse } from "../_shared/cors.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { revokeGoogleToken } from "../_shared/google.ts";
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
      .select("google_email,refresh_token_ciphertext,refresh_token_iv")
      .eq("workspace_id", admin.workspaceId).eq("owner_user_id", admin.user.id)
      .maybeSingle();
    if (error) throw new Error(`No se pudo consultar la conexión: ${error.message}`);
    if (!connection) throw new Error("No existe una conexión de Gmail para desconectar.");

    let warning = "";
    if (connection.refresh_token_ciphertext && connection.refresh_token_iv) {
      try {
        await revokeGoogleToken(await decryptSecret(connection.refresh_token_ciphertext, connection.refresh_token_iv));
      } catch (error) {
        warning = errorMessage(error);
      }
    }

    const disconnectedAt = new Date().toISOString();
    const { error: updateError } = await client.from("gmail_connections").update({
      status: "disconnected",
      refresh_token_ciphertext: null,
      refresh_token_iv: null,
      disconnected_at: disconnectedAt,
      last_error: warning || null
    }).eq("workspace_id", admin.workspaceId).eq("owner_user_id", admin.user.id);
    if (updateError) throw new Error(`No se pudo desconectar la cuenta: ${updateError.message}`);

    await client.from("gmail_integration_audit").insert({ workspace_id: admin.workspaceId,
      event_type: "oauth_disconnected",
      user_id: user.id,
      user_email: email,
      google_email: connection.google_email,
      detail: warning ? { warning } : {}
    });

    return jsonResponse(request, { ok: true, disconnected_at: disconnectedAt, warning: warning || null });
  } catch (error) {
    return jsonResponse(request, { error: errorMessage(error) }, 400);
  }
});




