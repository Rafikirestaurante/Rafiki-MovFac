import { corsHeaders } from "./cors.ts";

export function jsonResponse(request: Request, body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { ...corsHeaders(request), "Cache-Control": "no-store" } });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message; if (error && typeof error === "object") return JSON.stringify(error); return String(error || "Error desconocido");
}


