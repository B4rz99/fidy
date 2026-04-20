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
import { getSupabase } from "@/shared/db";
import { captureWarning, identifyUser, resetAnalyticsUser } from "@/shared/lib";

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

const REDIRECT_URI = "fidy://auth/callback";
let authTransitionVersion = 0;

function beginAuthTransition() {
  authTransitionVersion += 1;
  return authTransitionVersion;
}

function isCurrentAuthTransition(version: number) {
  return authTransitionVersion === version;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  session: null,
  localQaSession: null,
  isLoading: true,
  isSigningIn: false,

  restoreSession: async () => {
    const transitionVersion = beginAuthTransition();

    try {
      const persistedLocalQaSession = await loadLocalQaSession();

      if (persistedLocalQaSession) {
        if (!isCurrentAuthTransition(transitionVersion)) return;
        identifyUser(persistedLocalQaSession.userId);
        set({ session: null, localQaSession: persistedLocalQaSession, isLoading: false });
        return;
      }

      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if (!isCurrentAuthTransition(transitionVersion)) return;
      if (error || !data.session) {
        if (error) captureWarning("auth_restore_failed", { errorMessage: error.message });
        await clearOnboardingFromStore();
        if (!isCurrentAuthTransition(transitionVersion)) return;
        set({
          session: null,
          localQaSession: null,
          isLoading: false,
        });
        useLocalOnboardingState.getState().setIsComplete(false);
        return;
      }
      identifyUser(data.session.user.id);
      set({
        session: data.session,
        localQaSession: null,
        isLoading: false,
      });
    } catch (err) {
      if (!isCurrentAuthTransition(transitionVersion)) return;
      captureWarning("auth_restore_exception", {
        errorType: err instanceof Error ? err.message : "unknown",
      });
      set({
        session: null,
        localQaSession: null,
        isLoading: false,
      });
      useLocalOnboardingState.getState().setIsComplete(false);
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
      const { openAuthSessionAsync } = await import("expo-web-browser");
      await clearLocalQaSession().catch(() => undefined);
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        return;
      }
      const result = await openAuthSessionAsync(data.url, REDIRECT_URI);
      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.slice(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          const { data: sessionData } = await supabase.auth.setSession({
            // biome-ignore lint/style/useNamingConvention: Supabase API
            access_token: accessToken,
            // biome-ignore lint/style/useNamingConvention: Supabase API
            refresh_token: refreshToken,
          });
          if (sessionData.session) {
            identifyUser(sessionData.session.user.id);
            set({
              session: sessionData.session,
              localQaSession: null,
              isLoading: false,
            });
          }
        }
      }
    } catch (err) {
      captureWarning("auth_signin_failed", {
        errorType: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      set({ isSigningIn: false });
    }
  },

  signOut: async () => {
    beginAuthTransition();

    if (useAuthStore.getState().localQaSession) {
      await clearLocalQaSession().catch(() => undefined);
      await clearOnboardingFromStore();
      resetAnalyticsUser();
      set({
        session: null,
        localQaSession: null,
        isLoading: false,
      });
      useLocalOnboardingState.getState().setIsComplete(false);
      return;
    }

    // Clean up push token while session is still valid (RLS needs auth).
    // Capped at 2s so signout isn't blocked indefinitely by network issues.
    await Promise.race([
      cleanupCurrentPushToken().catch((error) => {
        captureWarning("auth_signout_push_token_cleanup_failed", {
          errorType: error instanceof Error ? error.message : "unknown",
        });
      }),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);

    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      // Clear local state regardless
    }
    await clearOnboardingFromStore();
    resetAnalyticsUser();
    set({
      session: null,
      localQaSession: null,
      isLoading: false,
    });
    useLocalOnboardingState.getState().setIsComplete(false);
  },
}));
