import { optionsResponse } from "../_shared/cors.ts";
import {releaseConfiguration} from '../_shared/release.ts';
import { jsonResponse, errorMessage } from "../_shared/http.ts";
import { requireAppAdmin } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;
  if (!["GET", "POST"].includes(request.method)) return jsonResponse(request, { error: "Método no permitido." }, 405);
  try {
    const admin = await requireAppAdmin(request);
    const body=request.method==='POST'?await request.json().catch(()=>({})):{};
    if(body.mode==='release')return jsonResponse(request,releaseConfiguration(request));
    const { client } = admin;
    const [{ data, error }, { data: recentErrors }] = await Promise.all([
      client
        .from("gmail_connections")
        .select("google_email,status,connected_at,last_verified_at,last_sync_at,last_error,disconnected_at,granted_scope")
        .eq("workspace_id", admin.workspaceId).eq("owner_user_id", admin.user.id)
        .maybeSingle(),
      client
        .from("processing_errors")
        .select("id,sync_run_id,source,stage,error_message,created_at")
        .eq("workspace_id", admin.workspaceId)
        .order("created_at", { ascending: false })
        .limit(5)
    ]);
    if (error) throw new Error(`No se pudo consultar la conexión: ${error.message}`);
    return jsonResponse(request, { configured: Boolean(data), connection: data || null, recent_errors: recentErrors || [] });
  } catch (error) {
    return jsonResponse(request, { error: errorMessage(error) }, 403);
  }
});





