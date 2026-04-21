// biome-ignore-all lint/style/useNamingConvention: OAuth/HTTP APIs use snake_case parameter names
import * as SecureStore from "expo-secure-store";
import { captureError, captureWarning } from "@/shared/lib";
import type { ConnectResult, RawEmail } from "../schema";
import { generatePkce } from "./email-adapter-pkce";
import type { EmailAdapter, EmailProviderConfig, FetchEmailsFn } from "./email-adapter-types";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
};

type ConnectError = Extract<ConnectResult, { success: false }>["error"];

type AuthorizationCodeResult =
  | {
      success: true;
      code: string;
      redirectUri: string;
      codeVerifier: string;
    }
  | {
      success: false;
      error: ConnectError;
    };

type ProfileEmailResult =
  | { success: true; email: string }
  | { success: false; error: "profile_fetch_failed" | "no_email_found" };

async function hasStoredToken(config: EmailProviderConfig): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(config.tokenKey)) != null;
  } catch (error) {
    captureError(error);
    return false;
  }
}

async function clearStoredTokens(config: EmailProviderConfig): Promise<void> {
  await SecureStore.deleteItemAsync(config.tokenKey);
  await SecureStore.deleteItemAsync(config.refreshTokenKey);
}

async function storeTokens(config: EmailProviderConfig, tokens: TokenResponse): Promise<void> {
  await SecureStore.setItemAsync(config.tokenKey, tokens.access_token);
  if (tokens.refresh_token) {
    await SecureStore.setItemAsync(config.refreshTokenKey, tokens.refresh_token);
  }
}

function buildAuthParams(input: {
  config: EmailProviderConfig;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}) {
  return new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.config.scope,
    ...input.config.extraAuthParams,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
}

async function requestAuthorizationCode(input: {
  config: EmailProviderConfig;
  clientId: string;
}): Promise<AuthorizationCodeResult> {
  const { openAuthSessionAsync } = await import("expo-web-browser");
  const redirectUri = input.config.getRedirectUri();
  const { codeVerifier, codeChallenge } = await generatePkce();
  const result = await openAuthSessionAsync(
    `${input.config.authUrl}?${buildAuthParams({
      config: input.config,
      clientId: input.clientId,
      redirectUri,
      codeChallenge,
    })}`,
    redirectUri
  );

  if (result.type !== "success" || !result.url) {
    return { success: false, error: "cancelled" };
  }

  const code = new URL(result.url).searchParams.get("code");
  return code == null
    ? { success: false, error: "no_code" }
    : { success: true, code, redirectUri, codeVerifier };
}

function buildTokenExchangeBody(input: {
  config: EmailProviderConfig;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  return new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    ...input.config.extraTokenExchangeParams,
    code_verifier: input.codeVerifier,
  }).toString();
}

async function exchangeAuthorizationCode(input: {
  config: EmailProviderConfig;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse | null> {
  const tokenResponse = await fetch(input.config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildTokenExchangeBody(input),
  });

  return tokenResponse.ok ? ((await tokenResponse.json()) as TokenResponse) : null;
}

async function fetchProfileEmail(input: {
  config: EmailProviderConfig;
  accessToken: string;
}): Promise<ProfileEmailResult> {
  const profileResponse = await fetch(input.config.profileUrl, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });

  if (!profileResponse.ok) {
    return { success: false, error: "profile_fetch_failed" };
  }

  const profile = (await profileResponse.json()) as Record<string, unknown>;
  const email = input.config.extractEmail(profile);
  return email == null ? { success: false, error: "no_email_found" } : { success: true, email };
}

async function connectAdapter(input: {
  config: EmailProviderConfig;
  clientId: string;
}): Promise<ConnectResult> {
  try {
    const authResult = await requestAuthorizationCode(input);
    if (!authResult.success) return { success: false, error: authResult.error };

    const tokens = await exchangeAuthorizationCode({
      config: input.config,
      clientId: input.clientId,
      code: authResult.code,
      redirectUri: authResult.redirectUri,
      codeVerifier: authResult.codeVerifier,
    });
    if (tokens == null) return { success: false, error: "token_exchange_failed" };

    await storeTokens(input.config, tokens);
    const profileResult = await fetchProfileEmail({
      config: input.config,
      accessToken: tokens.access_token,
    });
    return profileResult.success
      ? { success: true, email: profileResult.email }
      : { success: false, error: profileResult.error };
  } catch (error) {
    captureError(error);
    return { success: false, error: "cancelled" };
  }
}

function buildRefreshBody(input: {
  config: EmailProviderConfig;
  clientId: string;
  refreshToken: string;
}) {
  return new URLSearchParams({
    client_id: input.clientId,
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    ...input.config.extraRefreshParams,
  }).toString();
}

async function refreshAccessToken(input: {
  config: EmailProviderConfig;
  clientId: string;
  refreshToken: string;
}): Promise<string | null> {
  const refreshResponse = await fetch(input.config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildRefreshBody(input),
  });

  if (!refreshResponse.ok) {
    captureWarning("email_token_refresh_failed", {
      provider: input.config.provider,
      httpStatus: refreshResponse.status,
    });
    return null;
  }

  const tokens = (await refreshResponse.json()) as TokenResponse;
  await storeTokens(input.config, tokens);
  return tokens.access_token;
}

async function getValidToken(input: {
  config: EmailProviderConfig;
  clientId: string;
}): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(input.config.tokenKey);
    if (!token) return null;

    const testResponse = await fetch(input.config.profileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (testResponse.ok) return token;

    const refreshToken = await SecureStore.getItemAsync(input.config.refreshTokenKey);
    return refreshToken == null
      ? null
      : refreshAccessToken({
          config: input.config,
          clientId: input.clientId,
          refreshToken,
        });
  } catch (error) {
    captureError(error);
    return null;
  }
}

export function createAdapter(config: EmailProviderConfig, fetchFn: FetchEmailsFn): EmailAdapter {
  return {
    isConnected: () => hasStoredToken(config),
    disconnect: () => clearStoredTokens(config),
    connect: (clientId) => connectAdapter({ config, clientId }),
    fetchEmails: async (
      clientId: string,
      since: string,
      senderEmails: string[]
    ): Promise<RawEmail[]> => {
      const token = await getValidToken({ config, clientId });
      return token == null ? [] : fetchFn(token, since, senderEmails);
    },
  };
}
