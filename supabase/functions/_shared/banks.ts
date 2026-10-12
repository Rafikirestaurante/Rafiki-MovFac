import { BANCOLOMBIA_SENDER_QUERY } from "./bancolombia.ts";
export function selectedBanks(value:unknown):string[] {
  if (value === undefined) return ["bancolombia"];
  if (!Array.isArray(value) || !value.length || value.some(bank => !["bancolombia","nequi"].includes(bank))) throw new Error("Selecciona al menos un banco válido.");
  return [...new Set(value)] as string[];
}
export function bankQuery(banks:string[]):string {
  const parts = banks.map(bank => bank === "nequi" ? "from:notificaciones@nequi.com.co" : BANCOLOMBIA_SENDER_QUERY.slice(1,-1));
  return `{${parts.join(" ")}}`;
}
