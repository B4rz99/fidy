import * as SecureStore from "expo-secure-store";
import type { ConnectResult, RawEmail } from "../schema";
import { EMAIL_REDIRECT_URI } from "../schema";

const TOKEN_KEY = "email-gmail-token";
const REFRESH_TOKEN_KEY = "email-gmail-refresh-token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function isGmailConnected(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token != null;
}

async function getValidToken(clientId: string): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;

  const testResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (testResponse.ok) return token;

  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const refreshResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!refreshResponse.ok) return null;

  const data = await refreshResponse.json();
  await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
  if (data.refresh_token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refresh_token);
  }
  return data.access_token;
}

export async function connectGmail(clientId: string): Promise<ConnectResult> {
  const { openAuthSessionAsync } = await import("expo-web-browser");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: EMAIL_REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

  const result = await openAuthSessionAsync(`${AUTH_URL}?${params}`, EMAIL_REDIRECT_URI);

  if (result.type !== "success" || !result.url) {
    return { success: false, error: "cancelled" };
  }

  const code = new URL(result.url).searchParams.get("code");
  if (!code) {
    return { success: false, error: "no_code" };
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: EMAIL_REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenResponse.ok) {
    return { success: false, error: "token_exchange_failed" };
  }

  const tokens = await tokenResponse.json();
  await SecureStore.setItemAsync(TOKEN_KEY, tokens.access_token);
  if (tokens.refresh_token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    return { success: false, error: "profile_fetch_failed" };
  }

  const profile = await profileResponse.json();
  return { success: true, email: profile.emailAddress };
}

export async function disconnectGmail(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function fetchGmailEmails(
  clientId: string,
  since: string,
  senderEmails: string[]
): Promise<RawEmail[]> {
  const token = await getValidToken(clientId);
  if (!token) return [];

  const epoch = Math.floor(new Date(since).getTime() / 1000);
  const fromQuery = senderEmails.map((e) => `from:${e}`).join(" OR ");
  const query = `(${fromQuery}) after:${epoch}`;

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listResponse.ok) return [];

  const listData = await listResponse.json();
  const messageIds: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);

  if (messageIds.length === 0) return [];

  const Concurrency = 5;
  const emails: RawEmail[] = [];

  for (let i = 0; i < messageIds.length; i += Concurrency) {
    const batch = messageIds.slice(i, i + Concurrency);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgResponse.ok) return null;
        const msg = await msgResponse.json();
        return parseGmailMessage(id, msg);
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) emails.push(r.value);
    }
  }

  return emails;
}

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailPayload = { headers: GmailHeader[]; parts?: GmailPart[]; body?: { data?: string } };

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractPlainText(payload: GmailPayload): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractPlainText({
          headers: [],
          parts: part.parts,
        });
        if (nested) return nested;
      }
    }
  }
  return "";
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseGmailMessage(id: string, msg: { payload: GmailPayload }): RawEmail | null {
  const headers = msg.payload.headers;
  const from = getHeader(headers, "From");
  const subject = getHeader(headers, "Subject");
  const dateStr = getHeader(headers, "Date");
  const body = extractPlainText(msg.payload);

  if (!from || !subject) return null;

  const emailMatch = from.match(/<(.+?)>/) ?? [null, from];
  const emailAddress = emailMatch[1] ?? from;

  const parsedDate = new Date(dateStr);
  const receivedAt = Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString()
    : parsedDate.toISOString();

  return {
    externalId: id,
    from: emailAddress,
    subject,
    body,
    receivedAt,
    provider: "gmail",
  };
}
