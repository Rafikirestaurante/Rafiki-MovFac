function normalizeOrigin(value: string): string {
  return String(value || "").trim().replace(/\/$/, "");
}

function configuredOrigins(): string[] {
  const values = [Deno.env.get("APP_PUBLIC_URL") || "", Deno.env.get("APP_ALLOWED_ORIGINS") || ""]
    .flatMap((value) => String(value).split(","))
    .map(normalizeOrigin)
    .filter(Boolean);
  return [...new Set(values)];
}

function responseOrigin(request?: Request): string {
  const requestOrigin = normalizeOrigin(request?.headers.get("origin") || "");
  const allowed = configuredOrigins();
  const isHttpOrigin = /^https?:\/\//i.test(requestOrigin);

  // Las funciones no usan cookies ni confían en CORS como mecanismo de autorización.
  // Los endpoints administrativos validan JWT y los públicos validan su token propio.
  // Reflejar el origen HTTP evita que una URL válida de Vercel (producción, dominio
  // personalizado o preview) quede bloqueada por una diferencia en APP_PUBLIC_URL.
  if (requestOrigin && isHttpOrigin) return requestOrigin;
  return allowed[0] || "*";
}

export function corsHeaders(request?: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": responseOrigin(request),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-employee-access-token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "content-length, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

export function optionsResponse(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  return new Response("ok", { status: 200, headers: corsHeaders(request) });
}

