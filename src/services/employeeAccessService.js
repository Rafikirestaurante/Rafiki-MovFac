import { supabase, supabaseConfigured } from "../supabaseClient.js";

const storageKey = "rafiki-mf-employee-access";

function ensureClient() {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase todavía no está configurado.");
  return supabase;
}

async function describeFunctionError(error, fallback) {
  if (!error) return fallback;
  try {
    const response = error.context;
    if (response && typeof response.clone === "function") {
      const payload = await response.clone().json();
      if (payload?.error) return String(payload.error);
    }
  } catch {
    // La respuesta puede no contener JSON.
  }
  return String(error.message || fallback);
}

async function invoke(name, body = {}, employeeToken = "") {
  const client = ensureClient();
  const options = { body };
  if (employeeToken) options.headers = { "x-employee-access-token": employeeToken };
  const { data, error } = await client.functions.invoke(name, options);
  if (error) throw new Error(await describeFunctionError(error, `No se pudo ejecutar ${name}.`));
  if (data?.error) throw new Error(String(data.error));
  return data || {};
}

export async function getEmployeeAccessSettings() {
  return invoke("employee-access-admin", { action: "get" });
}

export async function saveEmployeeAccessSettings({ username, password, enabled }) {
  return invoke("employee-access-admin", { action: "save", username, password, enabled });
}

export async function employeePublicLogin(username, password) {
  const data = await invoke("employee-public-access", { action: "login", username, password });
  const session = { access_token: data.access_token, expires_at: data.expires_at, username: data.username };
  localStorage.setItem(storageKey, JSON.stringify(session));
  return session;
}

export function getStoredEmployeeSession() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!value?.access_token || !value?.expires_at || new Date(value.expires_at).getTime() <= Date.now()) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return value;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function clearEmployeeSession() {
  localStorage.removeItem(storageKey);
}

export async function getEmployeePublicMovements(token) {
  return invoke("employee-public-access", { action: "list" }, token);
}

export async function confirmEmployeePayment(token, movementId, employeeName, note = "") {
  return invoke("employee-public-access", { action: "confirm", movement_id: movementId, employee_name: employeeName, note }, token);
}

export async function syncEmployeePublicMovements(token, hours = 1) {
  return invoke("gmail-sync-now", { mode: "quick", quick_hours: hours }, token);
}
