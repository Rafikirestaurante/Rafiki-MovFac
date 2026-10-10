import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.106.2";
import { requiredEnv } from "./env.ts";

export function adminClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

export type AdminContext = { client: SupabaseClient; user: User; email: string; role: string };

export async function requireAppAdmin(request: Request): Promise<AdminContext> {
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Sesión administrativa no encontrada.");
  const client = adminClient();
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new Error("La sesión venció. Inicia sesión nuevamente.");

  const email = String(userData.user.email || "").trim().toLowerCase();
  const { data: profile, error: profileError } = await client
    .from("app_users")
    .select("role,status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw new Error(`No se pudo validar el rol: ${profileError.message}`);
  if (!profile || profile.status !== "active" || !["platform_admin", "workspace_owner", "admin"].includes(profile.role)) {
    throw new Error("Solo el propietario del workspace puede configurar su Gmail.");
  }
  return { client, user: userData.user, email, role: profile.role };
}
