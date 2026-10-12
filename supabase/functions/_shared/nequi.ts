import { flattenText, normalizeCopAmount, extractTransactionDateTime, type BancolombiaExtraction } from "./bancolombia.ts";

export function extractNequiMovement(input: {text?:string;subject?:string;snippet?:string;receivedAt:Date|string|number}): BancolombiaExtraction|null {
  const text = flattenText([input.subject,input.text,input.snippet].filter(Boolean).join(" "));
  const match = text.match(/\brecibiste\s+\$?\s*([\d][\d.,]*)\s+de\s+(.+?)\s+el\s+(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}\s+a\s+las\s+\d{1,2}:\d{2}\s*[ap]\.?m\.?)(?:\s*,\s*desde\s+el\s+banco\s+([^.!]+))?/i);
  if (!/recibiste plata por bre-b/i.test(text) || !match) return null;
  const amount = normalizeCopAmount(match[1]);
  if (amount === null || amount <= 0) throw new Error("Valor Nequi inválido");
  const moment = extractTransactionDateTime(match[3], input.receivedAt);
  return {movement_type:"income",amount_cop:amount,detail:match[2].trim(),transaction_date:moment.transaction_date,transaction_at:moment.transaction_at,reference_text:"",extraction_confidence:"high",source_metadata:{payment_kind:"Bre-B",origin_bank:match[4]?.trim() || null,extractor_rule:"nequi-5E-v1:income"}};
}
