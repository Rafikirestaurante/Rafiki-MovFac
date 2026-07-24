import { supabase, supabaseConfigured, supabaseUrl } from "../supabaseClient.js";

function edgeEndpoint(name) {
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}` : "";
}

async function responsePayload(error) {
  try {
    const response = error?.context;
    if (response && typeof response.clone === "function") {
      const clone = response.clone();
      const contentType = String(clone.headers?.get?.("content-type") || "");
      if (contentType.includes("application/json")) return await clone.json();
      const text = await clone.text();
      return text ? { error: text } : null;
    }
  } catch {
    // La respuesta puede estar bloqueada por CORS o no contener un cuerpo legible.
  }
  return null;
}

function categoryFor(error, message) {
  const name = String(error?.name || "");
  const value = String(message || "").toLowerCase();
  if (name === "FunctionsFetchError" || value.includes("failed to send") || value.includes("failed to fetch") || value.includes("networkerror")) return "transport";
  if (name === "FunctionsRelayError") return "relay";
  if (name === "FunctionsHttpError") return "http";
  return "application";
}

function diagnosticMessage(name, category, originalMessage) {
  if (category === "transport") {
    return `No fue posible contactar la Edge Function “${name}”. La petición no llegó a entregar una respuesta al navegador. Revisa su despliegue en Supabase, el origen permitido (APP_PUBLIC_URL/CORS) y la conexión a internet. Detalle original: ${originalMessage}`;
  }
  if (category === "relay") {
    return `Supabase recibió la solicitud para “${name}”, pero no pudo entregarla a la función. Revisa los registros de la Edge Function y vuelve a desplegarla. Detalle: ${originalMessage}`;
  }
  if (category === "http") {
    return `La Edge Function “${name}” respondió con error. Revisa el detalle mostrado y los logs de Supabase. Detalle: ${originalMessage}`;
  }
  return originalMessage || `No se pudo ejecutar la Edge Function “${name}”.`;
}

async function buildFunctionError(name, error, fallback) {
  const payload = await responsePayload(error);
  const originalMessage = String(payload?.error || payload?.message || error?.message || fallback);
  const category = categoryFor(error, originalMessage);
  const wrapped = new Error(diagnosticMessage(name, category, originalMessage));
  wrapped.name = "RafikiEdgeFunctionError";
  wrapped.functionName = name;
  wrapped.category = category;
  wrapped.originalMessage = originalMessage;
  wrapped.endpoint = edgeEndpoint(name);
  wrapped.browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  wrapped.online = typeof navigator === "undefined" ? true : navigator.onLine;
  wrapped.status = error?.context?.status || null;
  return wrapped;
}

async function invoke(name, body = {}) {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase todavía no está configurado.");
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw await buildFunctionError(name, error, `No se pudo ejecutar ${name}.`);
  if (data?.error) {
    const wrapped = new Error(String(data.error));
    wrapped.name = "RafikiEdgeFunctionError";
    wrapped.functionName = name;
    wrapped.category = "application";
    wrapped.originalMessage = String(data.error);
    wrapped.endpoint = edgeEndpoint(name);
    wrapped.browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
    wrapped.online = typeof navigator === "undefined" ? true : navigator.onLine;
    throw wrapped;
  }
  return data || {};
}

export function edgeErrorDetails(error, fallbackFunctionName = "") {
  return {
    function_name: error?.functionName || fallbackFunctionName || "desconocida",
    category: error?.category || "application",
    message: error?.message || "Error desconocido.",
    original_message: error?.originalMessage || error?.message || "Error desconocido.",
    endpoint: error?.endpoint || edgeEndpoint(error?.functionName || fallbackFunctionName),
    browser_origin: error?.browserOrigin || (typeof window !== "undefined" ? window.location.origin : ""),
    online: error?.online ?? (typeof navigator === "undefined" ? true : navigator.onLine),
    status: error?.status || null
  };
}

export const getGmailConnectionStatus = () => invoke("gmail-connection-status");
export const startGmailConnection = () => invoke("gmail-oauth-start");
export const testGmailConnection = () => invoke("gmail-test-connection");
export const diagnoseGmailConnection = () => invoke("gmail-diagnostics");
export const disconnectGmail = () => invoke("gmail-disconnect");
export const syncGmailNow = (dateFrom, dateTo) => invoke("gmail-sync-now", { mode: "range", date_from: dateFrom, date_to: dateTo });
export const syncGmailQuick = (hours = 1) => invoke("gmail-sync-now", { mode: "quick", quick_hours: hours });
export const syncInvoicesRecent = () => invoke("gmail-sync-invoices", { mode: "recent" });
export const syncInvoicesRange = (dateFrom, dateTo) => invoke("gmail-sync-invoices", { mode: "range", date_from: dateFrom, date_to: dateTo });

export async function getRecentSyncRuns(limit = 10) {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase todavía no está configurado.");
  const { data, error } = await supabase.from("gmail_sync_runs").select("id,status,started_at,finished_at,messages_scanned,movements_created,invoices_created,duplicates_ignored,errors_count,detail").order("started_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message || "No se pudo consultar el historial de sincronizaciones.");
  return data || [];
}
