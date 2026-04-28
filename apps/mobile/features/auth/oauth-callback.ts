export type SupabaseAuthTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

const parseUrl = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

const hasRedirectTarget = (callbackUrl: URL, redirectUrl: URL): boolean =>
  callbackUrl.protocol === redirectUrl.protocol &&
  callbackUrl.hostname === redirectUrl.hostname &&
  callbackUrl.pathname === redirectUrl.pathname;

const createSupabaseAuthTokens = (
  accessToken: string | null,
  refreshToken: string | null
): SupabaseAuthTokens | null => {
  if (accessToken === null || refreshToken === null) return null;
  return { accessToken, refreshToken };
};

export const readSupabaseSessionTokens = (
  callbackUrl: string,
  redirectUri: string
): SupabaseAuthTokens | null => {
  const parsedCallbackUrl = parseUrl(callbackUrl);
  const parsedRedirectUrl = parseUrl(redirectUri);
  if (parsedCallbackUrl === null) return null;
  if (parsedRedirectUrl === null) return null;
  if (!hasRedirectTarget(parsedCallbackUrl, parsedRedirectUrl)) return null;

  const params = new URLSearchParams(parsedCallbackUrl.hash.slice(1));
  return createSupabaseAuthTokens(params.get("access_token"), params.get("refresh_token"));
};
