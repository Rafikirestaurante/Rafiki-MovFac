import type {AdminContext} from "./supabase.ts";
import {selectedBanks} from "./banks.ts";
export async function workspaceBanks(context:AdminContext):Promise<string[]> {
  const {data,error}=await context.client.from("workspace_preferences").select("banks").eq("workspace_id",context.workspaceId).maybeSingle();
  if(error) throw new Error(`No se pudieron consultar los bancos del workspace: ${error.message}`);
  return selectedBanks(data?.banks);
}
