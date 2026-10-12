import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const fetchWithTimeout = (input, init = {}) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120000);
  return fetch(input, { ...init, signal: init.signal || controller.signal })
    .finally(() => window.clearTimeout(timer));
};

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: { fetch: fetchWithTimeout }
    })
  : null;

