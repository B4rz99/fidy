import * as SecureStore from "expo-secure-store";
import type { RawEmail } from "../schema";

const TOKEN_KEY = "email-outlook-token";
const REFRESH_TOKEN_KEY = "email-outlook-refresh-token";
const REDIRECT_URI = "fidy://email/callback";
const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPE = "Mail.Read";

type ConnectResult = { success: true; email: string } | { success: false; error: string };

export async function isOutlookConnected(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token != null;
}

async function getValidToken(clientId: string): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;

  const testResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
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
      scope: `${SCOPE} User.Read`,
    }).toString(),
  });

  if (!refreshResponse.ok) return null;

  const data = await refreshResponse.json();
  await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
  return data.access_token;
}

export async function connectOutlook(clientId: string): Promise<ConnectResult> {
  const { openAuthSessionAsync } = await import("expo-web-browser");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: `${SCOPE} User.Read`,
    prompt: "consent",
  });

  const result = await openAuthSessionAsync(`${AUTH_URL}?${params}`, REDIRECT_URI);

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
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      scope: `${SCOPE} User.Read`,
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

  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    return { success: false, error: "profile_fetch_failed" };
  }

  const profile = await profileResponse.json();
  const email = profile.mail || profile.userPrincipalName;
  if (!email) {
    return { success: false, error: "no_email_found" };
  }
  return { success: true, email };
}

export async function disconnectOutlook(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function fetchOutlookEmails(
  clientId: string,
  since: string,
  senderEmails: string[]
): Promise<RawEmail[]> {
  const token = await getValidToken(clientId);
  if (!token) return [];

  const senderFilter = senderEmails.map((e) => `from/emailAddress/address eq '${e}'`).join(" or ");
  const dateFilter = `receivedDateTime ge ${since}`;
  const filter = `(${senderFilter}) and ${dateFilter}`;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,body,from,receivedDateTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  const messages: OutlookMessage[] = data.value ?? [];

  return messages.map((msg) => ({
    externalId: msg.id,
    from: msg.from.emailAddress.address,
    subject: msg.subject,
    body: msg.body.content,
    receivedAt: msg.receivedDateTime,
    provider: "outlook" as const,
  }));
}

type OutlookMessage = {
  id: string;
  subject: string;
  from: { emailAddress: { address: string } };
  body: { content: string };
  receivedDateTime: string;
};
