export function getSelectedBanks(userId) {
  if (typeof localStorage === "undefined") return ["bancolombia"];
  try {
    const saved = JSON.parse(localStorage.getItem(`rafiki_banks_${userId}`));
    const banks = Array.isArray(saved) ? saved.filter(bank => ["bancolombia","nequi"].includes(bank)) : [];
    return banks.length ? banks : ["bancolombia"];
  } catch { return ["bancolombia"]; }
}
export function saveSelectedBanks(userId,banks) {
  if (!banks.length) return;
  localStorage.setItem(`rafiki_banks_${userId}`,JSON.stringify(banks));
}
import { supabase } from "../supabaseClient.js";
export async function loadWorkspaceBanks() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const {data,error} = await supabase.rpc("get_workspace_banks");
  if (error) throw new Error(`No se pudieron consultar los bancos: ${error.message}`);
  return data;
}
export async function saveWorkspaceBanks(banks) {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const {error} = await supabase.rpc("set_workspace_banks",{p_banks:banks});
  if (error) throw new Error(`No se pudieron guardar los bancos: ${error.message}`);
}
