// biome-ignore-all lint/style/useNamingConvention: OAuth/HTTP APIs use snake_case parameter names
import * as SecureStore from "expo-secure-store";
import { captureError } from "@/shared/lib";
import type { ConnectResult, EmailProvider, RawEmail } from "../schema";
import { EMAIL_REDIRECT_URI, getGmailRedirectUri } from "../schema";
import { fetchGmailEmailsWithToken } from "./gmail-adapter";
import { fetchOutlookEmailsWithToken } from "./outlook-adapter";

export type EmailProviderConfig = {
  provider: EmailProvider;
  tokenKey: string;
  refreshTokenKey: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  getRedirectUri: () => string;
  profileUrl: string;
  extractEmail: (profile: Record<string, unknown>) => string | null;
  extraAuthParams: Record<string, string>;
  extraTokenExchangeParams: Record<string, string>;
  extraRefreshParams: Record<string, string>;
};

export type FetchEmailsFn = (
  token: string,
  since: string,
  senderEmails: string[]
) => Promise<RawEmail[]>;

export type EmailAdapter = {
  isConnected: () => Promise<boolean>;
  connect: (clientId: string) => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  fetchEmails: (clientId: string, since: string, senderEmails: string[]) => Promise<RawEmail[]>;
};

export function createAdapter(config: EmailProviderConfig, fetchFn: FetchEmailsFn): EmailAdapter {
  const isConnected = async (): Promise<boolean> => {
    try {
      const token = await SecureStore.getItemAsync(config.tokenKey);
      return token != null;
    } catch (error) {
      captureError(error);
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(config.tokenKey);
    await SecureStore.deleteItemAsync(config.refreshTokenKey);
  };

  const connect = async (clientId: string): Promise<ConnectResult> => {
    try {
      const { openAuthSessionAsync } = await import("expo-web-browser");

      const redirectUri = config.getRedirectUri();
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: config.scope,
        ...config.extraAuthParams,
      });

      const result = await openAuthSessionAsync(`${config.authUrl}?${params}`, redirectUri);

      if (result.type !== "success" || !result.url) {
        return { success: false, error: "cancelled" };
      }

      const code = new URL(result.url).searchParams.get("code");
      if (!code) {
        return { success: false, error: "no_code" };
      }

      const tokenResponse = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          ...config.extraTokenExchangeParams,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        return { success: false, error: "token_exchange_failed" };
      }

      const tokens = await tokenResponse.json();
      await SecureStore.setItemAsync(config.tokenKey, tokens.access_token);
      if (tokens.refresh_token) {
        await SecureStore.setItemAsync(config.refreshTokenKey, tokens.refresh_token);
      }

      const profileResponse = await fetch(config.profileUrl, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!profileResponse.ok) {
        return { success: false, error: "profile_fetch_failed" };
      }

      const profile = await profileResponse.json();
      const email = config.extractEmail(profile);
      if (!email) {
        return { success: false, error: "no_email_found" };
      }

      return { success: true, email };
    } catch (error) {
      captureError(error);
      return { success: false, error: "cancelled" };
    }
  };

  const getValidToken = async (clientId: string): Promise<string | null> => {
    try {
      const token = await SecureStore.getItemAsync(config.tokenKey);
      if (!token) return null;

      const testResponse = await fetch(config.profileUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (testResponse.ok) return token;

      const refreshToken = await SecureStore.getItemAsync(config.refreshTokenKey);
      if (!refreshToken) return null;

      const refreshResponse = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          ...config.extraRefreshParams,
        }).toString(),
      });

      if (!refreshResponse.ok) return null;

      const data = await refreshResponse.json();
      await SecureStore.setItemAsync(config.tokenKey, data.access_token);
      if (data.refresh_token) {
        await SecureStore.setItemAsync(config.refreshTokenKey, data.refresh_token);
      }
      return data.access_token;
    } catch (error) {
      captureError(error);
      return null;
    }
  };

  const fetchEmails = async (
    clientId: string,
    since: string,
    senderEmails: string[]
  ): Promise<RawEmail[]> => {
    const token = await getValidToken(clientId);
    if (!token) return [];
    return fetchFn(token, since, senderEmails);
  };

  return { isConnected, connect, disconnect, fetchEmails };
}

// --- Provider configs ---

const gmailConfig: EmailProviderConfig = {
  provider: "gmail",
  tokenKey: "email-gmail-token",
  refreshTokenKey: "email-gmail-refresh-token",
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scope: "https://www.googleapis.com/auth/gmail.readonly",
  getRedirectUri: getGmailRedirectUri,
  profileUrl: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
  extractEmail: (profile) => (profile.emailAddress as string) ?? null,
  extraAuthParams: { access_type: "offline", prompt: "consent" },
  extraTokenExchangeParams: {},
  extraRefreshParams: {},
};

const outlookConfig: EmailProviderConfig = {
  provider: "outlook",
  tokenKey: "email-outlook-token",
  refreshTokenKey: "email-outlook-refresh-token",
  authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  scope: "Mail.Read User.Read",
  getRedirectUri: () => EMAIL_REDIRECT_URI,
  profileUrl: "https://graph.microsoft.com/v1.0/me",
  extractEmail: (profile) =>
    (profile.mail as string) || (profile.userPrincipalName as string) || null,
  extraAuthParams: { prompt: "consent" },
  extraTokenExchangeParams: { scope: "Mail.Read User.Read" },
  extraRefreshParams: { scope: "Mail.Read User.Read" },
};

const adapters: Record<EmailProvider, EmailAdapter> = {
  gmail: createAdapter(gmailConfig, fetchGmailEmailsWithToken),
  outlook: createAdapter(outlookConfig, fetchOutlookEmailsWithToken),
};

export function getAdapter(provider: EmailProvider): EmailAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Unknown email provider: ${provider}`);
  return adapter;
}
