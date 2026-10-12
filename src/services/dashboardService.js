import { supabase, supabaseConfigured } from "../supabaseClient.js";
import { bogotaDateKeyFromTimestamp, monthRange } from "../utils/calendar.js";

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase todavía no está configurado.");
}

function isUnrecognizedBancolombia(row) {
  const metadata = row?.raw_metadata || {};
  return ["bancolombia", "nequi"].includes(metadata.source_detected) && (
    metadata.requires_review === true ||
    metadata.extraction_result === "unsupported_notification" ||
    metadata.extraction_result === "error"
  );
}

export async function getDashboardMonthData(monthKey) {
  ensureSupabase();
  const { start, nextStart } = monthRange(monthKey);
  const startTimestamp = `${start}T00:00:00-05:00`;
  const nextTimestamp = `${nextStart}T00:00:00-05:00`;

  const [movementsResult, invoicesResult, candidatesResult] = await Promise.all([
    supabase
      .from("financial_movements")
      .select("id,source,movement_type,transaction_date,transaction_at,email_received_at,detail,amount_cop,reference_text,email_subject")
      .gte("transaction_date", start)
      .lt("transaction_date", nextStart)
      .order("transaction_at", { ascending: false }),
    supabase
      .from("electronic_invoices")
      .select("id,invoice_date,supplier_name,supplier_tax_id,invoice_number,total_cop,document_status,source_file_type,email_received_at")
      .or(`and(invoice_date.gte.${start},invoice_date.lt.${nextStart}),and(invoice_date.is.null,email_received_at.gte.${startTimestamp},email_received_at.lt.${nextTimestamp})`)
      .order("invoice_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("gmail_sync_candidates")
      .select("id,gmail_message_id,internal_date,sender,subject,snippet,processing_status,raw_metadata,last_detected_at")
      .in("processing_status", ["ignored", "error"])
      .gte("internal_date", startTimestamp)
      .lt("internal_date", nextTimestamp)
      .order("internal_date", { ascending: false })
      .limit(500)
  ]);

  if (movementsResult.error) throw new Error(movementsResult.error.message || "No se pudieron consultar los movimientos del calendario.");
  if (invoicesResult.error) throw new Error(invoicesResult.error.message || "No se pudieron consultar las facturas del calendario.");
  if (candidatesResult.error) throw new Error(candidatesResult.error.message || "No se pudieron consultar las alertas de Bancolombia para revisión.");

  const alerts = (candidatesResult.data || [])
    .filter(isUnrecognizedBancolombia)
    .map((row) => ({ ...row, date_key: bogotaDateKeyFromTimestamp(row.internal_date) }));

  const invoices = (invoicesResult.data || []).map((row) => ({
    ...row,
    date_key: row.invoice_date || bogotaDateKeyFromTimestamp(row.email_received_at)
  }));

  return {
    movements: movementsResult.data || [],
    invoices,
    alerts
  };
}
