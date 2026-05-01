import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { cleanupCurrentPushToken } from "@/features/notifications/public";
import { clearOnboardingFromStore } from "@/features/onboarding/lib/check-onboarding";
import { useLocalOnboardingState } from "@/features/onboarding/lib/local-onboarding-state";
import {
  clearLocalQaSession,
  type LocalQaProfile,
  type LocalQaSession,
  loadLocalQaSession,
} from "@/features/qa/local-session";
import { getSupabase } from "@/shared/db/supabase";
import { captureWarning, identifyUser, resetAnalyticsUser } from "@/shared/lib";
import { readSupabaseSessionTokens, type SupabaseAuthTokens } from "./oauth-callback";

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
type OAuthProvider = "google" | "azure";

type AuthState = {
  session: Session | null;
  localQaSession: LocalQaSession | null;
  isLoading: boolean;
  isSigningIn: boolean;
};

type AuthActions = {
  restoreSession: () => Promise<void>;
  startLocalQaSession: (profile?: LocalQaProfile) => Promise<void>;
  signIn: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
};

type SetAuthState = (nextState: Partial<AuthState>) => void;

const REDIRECT_URI = "fidy://auth/callback";
let authTransitionVersion = 0;

function beginAuthTransition() {
  authTransitionVersion += 1;
  return authTransitionVersion;
}

function isCurrentAuthTransition(version: number) {
  return authTransitionVersion === version;
}

function isStaleAuthTransition(version: number) {
  return !isCurrentAuthTransition(version);
}

function setSignedOutAuthState(set: SetAuthState) {
  set({
    session: null,
    localQaSession: null,
    isLoading: false,
  });
}

function setLocalQaAuthState(set: SetAuthState, localQaSession: LocalQaSession) {
  identifyUser(localQaSession.userId);
  set({
    session: null,
    localQaSession,
    isLoading: false,
  });
}

function setRemoteAuthState(set: SetAuthState, session: Session) {
  identifyUser(session.user.id);
  set({
    session,
    localQaSession: null,
    isLoading: false,
  });
}

function clearLocalOnboardingState() {
  useLocalOnboardingState.getState().setIsComplete(false);
}

async function clearOnboardingAndAuthState(set: SetAuthState) {
  await clearOnboardingFromStore();
  setSignedOutAuthState(set);
  clearLocalOnboardingState();
}

function captureAuthFailure(event: string, err: unknown) {
  captureWarning(event, {
    errorType: err instanceof Error ? err.message : "unknown",
  });
}

async function restoreStoredLocalQaSession(
  set: SetAuthState,
  transitionVersion: number
): Promise<boolean> {
  const persistedLocalQaSession = await loadLocalQaSession();
  if (persistedLocalQaSession == null) return false;
  if (isStaleAuthTransition(transitionVersion)) return true;
  setLocalQaAuthState(set, persistedLocalQaSession);
  return true;
}

async function handleMissingRemoteSession(
  set: SetAuthState,
  transitionVersion: number,
  errorMessage?: string
) {
  if (errorMessage) {
    captureWarning("auth_restore_failed", { errorMessage });
  }
  await clearOnboardingFromStore();
  if (isStaleAuthTransition(transitionVersion)) return;
  setSignedOutAuthState(set);
  clearLocalOnboardingState();
}

async function restoreSupabaseSession(set: SetAuthState, transitionVersion: number) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (isStaleAuthTransition(transitionVersion)) return;
  if (error || !data.session) {
    await handleMissingRemoteSession(set, transitionVersion, error?.message);
    return;
  }
  const userResult = await supabase.auth.getUser();
  if (isStaleAuthTransition(transitionVersion)) return;
  if (userResult.error || !userResult.data.user) {
    await signOutRemoteSession();
    await handleMissingRemoteSession(set, transitionVersion, userResult.error?.message);
    return;
  }
  setRemoteAuthState(set, data.session);
}

async function handleRestoreSessionException(
  set: SetAuthState,
  transitionVersion: number,
  err: unknown
) {
  if (isStaleAuthTransition(transitionVersion)) return;
  captureAuthFailure("auth_restore_exception", err);
  setSignedOutAuthState(set);
  clearLocalOnboardingState();
}

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

async function signInWithProvider(provider: OAuthProvider): Promise<Session | null> {
  const authUrl = await requestOauthUrl(provider);
  if (authUrl === null) return null;

  return restoreProviderSession(authUrl);
}

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

async function signOutLocalQaSession(set: SetAuthState) {
  await clearLocalQaSession().catch(() => undefined);
  await clearOnboardingAndAuthState(set);
  resetAnalyticsUser();
}

async function cleanupPushTokenBeforeSignOut() {
  await Promise.race([
    cleanupCurrentPushToken().catch((error) => {
      captureAuthFailure("auth_signout_push_token_cleanup_failed", error);
    }),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}

async function signOutRemoteSession() {
  try {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  } catch {
    // Clear local state regardless.
  }
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  session: null,
  localQaSession: null,
  isLoading: true,
  isSigningIn: false,

  restoreSession: async () => {
    const transitionVersion = beginAuthTransition();

    try {
      const didRestoreLocalQaSession = await restoreStoredLocalQaSession(set, transitionVersion);
      if (didRestoreLocalQaSession) return;
      await restoreSupabaseSession(set, transitionVersion);
    } catch (err) {
      await handleRestoreSessionException(set, transitionVersion, err);
    }
  },

  startLocalQaSession: async (profile) => {
    const transitionVersion = beginAuthTransition();
    set({ isLoading: true });
    try {
      const { startLocalQaSession: prepareLocalQaSession } = await import(
        "@/features/qa/start-local-qa-session"
      );
      const localQaSession = await prepareLocalQaSession(profile);
      if (!isCurrentAuthTransition(transitionVersion)) return;
      identifyUser(localQaSession.userId);
      set({
        session: null,
        localQaSession,
        isLoading: false,
      });
      useLocalOnboardingState.getState().setIsComplete(false);
    } catch (err) {
      if (!isCurrentAuthTransition(transitionVersion)) return;
      captureWarning("auth_start_local_qa_failed", {
        errorType: err instanceof Error ? err.message : "unknown",
      });
      set({
        session: null,
        localQaSession: null,
        isLoading: false,
      });
      throw err;
    }
  },

  signIn: async (provider) => {
    beginAuthTransition();
    set({ isSigningIn: true });
    try {
      const session = await signInWithProvider(provider);
      if (session !== null) setRemoteAuthState(set, session);
    } catch (err) {
      captureAuthFailure("auth_signin_failed", err);
    } finally {
      set({ isSigningIn: false });
    }
  },

  signOut: async () => {
    beginAuthTransition();

    if (useAuthStore.getState().localQaSession) {
      await signOutLocalQaSession(set);
      return;
    }

    // Clean up push token while session is still valid (RLS needs auth).
    // Capped at 2s so signout isn't blocked indefinitely by network issues.
    await cleanupPushTokenBeforeSignOut();
    await signOutRemoteSession();
    await clearOnboardingAndAuthState(set);
    resetAnalyticsUser();
  },
}));
