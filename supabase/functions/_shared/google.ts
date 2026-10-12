import { requiredEnv } from "./env.ts";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GmailProfile = {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
};

export function googleAuthorizationUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requiredEnv("GOOGLE_GMAIL_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requiredEnv("GOOGLE_GMAIL_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_READONLY_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

async function parseGoogleResponse(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google respondió: ${String(data.error_description || data.error || response.statusText)}`);
  return data;
}

export async function exchangeAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
    redirect_uri: requiredEnv("GOOGLE_GMAIL_REDIRECT_URI"),
    grant_type: "authorization_code"
  });
  return (await parseGoogleResponse(await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal:AbortSignal.timeout(15000),
    body
  }))) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
    grant_type: "refresh_token"
  });
  return (await parseGoogleResponse(await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal:AbortSignal.timeout(15000),
    body
  }))) as GoogleTokenResponse;
}

export async function getGmailProfile(accessToken: string): Promise<GmailProfile> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${accessToken}` },signal:AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`No se pudo consultar Gmail: ${String(data.error?.message || response.statusText)}`);
  return data as GmailProfile;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  const response = await fetch('https://oauth2.googleapis.com/revoke', { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },body:new URLSearchParams({token}),signal:AbortSignal.timeout(15000) });
  if (!response.ok && response.status !== 400) throw new Error(`Google no pudo revocar el acceso (${response.status}).`);
}

