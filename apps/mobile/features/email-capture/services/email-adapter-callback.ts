import type { ConnectResult } from "../schema";

type ConnectError = Extract<ConnectResult, { success: false }>["error"];

export type CallbackCodeResult =
  | { readonly success: true; readonly code: string }
  | { readonly success: false; readonly error: ConnectError };

const parseUrl = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

const hasCallbackTarget = (actual: URL, expected: URL): boolean =>
  actual.protocol === expected.protocol &&
  actual.hostname === expected.hostname &&
  actual.port === expected.port &&
  actual.pathname === expected.pathname;

const invalidCallback = (): CallbackCodeResult => ({ success: false, error: "invalid_callback" });

const hasExpectedState = (callbackUrl: URL, state: string): boolean =>
  callbackUrl.searchParams.get("state") === state;

const readValidCallbackUrl = (input: {
  readonly callbackUrl: string;
  readonly redirectUri: string;
  readonly state: string;
}): URL | null => {
  const callbackUrl = parseUrl(input.callbackUrl);
  const redirectUri = parseUrl(input.redirectUri);
  if (callbackUrl === null) return null;
  if (redirectUri === null) return null;
  if (!hasCallbackTarget(callbackUrl, redirectUri)) return null;
  if (!hasExpectedState(callbackUrl, input.state)) return null;
  return callbackUrl;
};

const readCodeParam = (callbackUrl: URL): CallbackCodeResult => {
  const code = callbackUrl.searchParams.get("code");
  if (code === null || code.length === 0) return { success: false, error: "no_code" };
  return { success: true, code };
};

export const readOauthCallbackCode = (input: {
  readonly callbackUrl: string;
  readonly redirectUri: string;
  readonly state: string;
}): CallbackCodeResult => {
  const callbackUrl = readValidCallbackUrl(input);
  return callbackUrl === null ? invalidCallback() : readCodeParam(callbackUrl);
};
