import type { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { create } from "zustand";
import { deletePushToken, PROJECT_ID } from "@/features/notifications/services/push-token";
import { getSupabase } from "@/shared/db";
import { captureWarning, identifyUser, resetAnalyticsUser } from "@/shared/lib";

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
type OAuthProvider = "google" | "azure";

type AuthState = {
  session: Session | null;
  isLoading: boolean;
  isSigningIn: boolean;
};

type AuthActions = {
  restoreSession: () => Promise<void>;
  signIn: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
};

const REDIRECT_URI = "fidy://auth/callback";

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  session: null,
  isLoading: true,
  isSigningIn: false,

  restoreSession: async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        if (error) captureWarning("auth_restore_failed", { errorMessage: error.message });
        set({ session: null, isLoading: false });
        return;
      }
      identifyUser(data.session.user.id);
      set({ session: data.session, isLoading: false });
    } catch (err) {
      captureWarning("auth_restore_exception", {
        errorType: err instanceof Error ? err.message : "unknown",
      });
      set({ session: null, isLoading: false });
    }
  },

  signIn: async (provider) => {
    set({ isSigningIn: true });
    try {
      const { openAuthSessionAsync } = await import("expo-web-browser");
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
            set({ session: sessionData.session, isLoading: false });
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
    // Best-effort push token cleanup before signing out
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: PROJECT_ID,
      });
      await deletePushToken(token);
    } catch {
      // Don't block signout on token cleanup failure
    }

    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      // Clear local state regardless
    }
    resetAnalyticsUser();
    set({ session: null });
  },
}));
