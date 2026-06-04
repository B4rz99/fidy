import type { Session } from "@supabase/supabase-js";
import { clearLocalQaSession } from "@/features/qa/session.public";
import { getSupabase } from "@/shared/db/supabase";
import { readSupabaseSessionTokens, type SupabaseAuthTokens } from "./oauth-callback";

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
export type OAuthProvider = "google" | "azure";

const REDIRECT_URI = "fidy://auth/callback";

async function requestOauthUrl(provider: OAuthProvider): Promise<string | null> {
  await clearLocalQaSession().catch(() => undefined);
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true },
  });
  return error || !data.url ? null : data.url;
}

async function openOauthBrowser(url: string): Promise<string | null> {
  const { openAuthSessionAsync } = await import("expo-web-browser");
  const result = await openAuthSessionAsync(url, REDIRECT_URI);
  return result.type === "success" && result.url ? result.url : null;
}

const getSupabaseSessionTokens = (url: string): SupabaseAuthTokens | null => {
  return readSupabaseSessionTokens(url, REDIRECT_URI);
};

async function restoreProviderSession(authUrl: string): Promise<Session | null> {
  const sessionUrl = await openOauthBrowser(authUrl);
  if (sessionUrl === null) return null;
  return exchangeProviderSession(sessionUrl);
}

async function exchangeProviderSession(sessionUrl: string): Promise<Session | null> {
  const sessionTokens = getSupabaseSessionTokens(sessionUrl);
  if (sessionTokens === null) return null;
  const supabase = getSupabase();
  const { data } = await supabase.auth.setSession({
    // biome-ignore lint/style/useNamingConvention: Supabase API
    access_token: sessionTokens.accessToken,
    // biome-ignore lint/style/useNamingConvention: Supabase API
    refresh_token: sessionTokens.refreshToken,
  });
  return data.session ?? null;
}

export async function signInWithProvider(provider: OAuthProvider): Promise<Session | null> {
  const authUrl = await requestOauthUrl(provider);
  return authUrl === null ? null : restoreProviderSession(authUrl);
}
