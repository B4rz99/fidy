import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import {
  clearCloudLedgerRuntimeCache,
  resumeCloudLedgerRuntimeCacheWrites,
  suspendCloudLedgerRuntimeCacheWrites,
} from "@/features/cloud-ledger/runtime.public";
import { discardCloudLedgerOutbox } from "@/features/cloud-ledger/outbox.public";
import { clearOnboardingFromStore } from "@/features/onboarding/store.public";
import { useLocalOnboardingState } from "@/features/onboarding/store.public";
import {
  clearLocalQaSession,
  type LocalQaProfile,
  type LocalQaSession,
  loadLocalQaSession,
} from "@/features/qa/session.public";
import {
  deleteCloudLedgerTransactionCache,
  invalidateTransactionSession,
  resumeTransactionSession,
} from "@/features/transactions/store.public";
import { getSupabase } from "@/shared/db/supabase";
import { captureWarning, identifyUser, resetAnalyticsUser } from "@/shared/lib";
import { requireUserId } from "@/shared/types/assertions";
import type { UserId } from "@/shared/types/branded";
import { type OAuthProvider, signInWithProvider } from "./provider-sign-in";
import { cleanupPushTokenBeforeSignOut, signOutRemoteSession } from "./sign-out";

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

function isMissingRemoteUserError(message: string | undefined) {
  const normalizedMessage = message?.toLowerCase() ?? "";
  return normalizedMessage.includes("user") && normalizedMessage.includes("does not exist");
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

async function handleMissingValidatedUser(
  set: SetAuthState,
  transitionVersion: number,
  errorMessage?: string
) {
  await signOutRemoteSession();
  if (isStaleAuthTransition(transitionVersion)) return;
  await handleMissingRemoteSession(set, transitionVersion, errorMessage);
}

function hasMissingRemoteSession(error: unknown, session: Session | null): session is null {
  return error != null || session == null;
}

function shouldHandleMissingValidatedUser(
  userResult: Awaited<ReturnType<ReturnType<typeof getSupabase>["auth"]["getUser"]>>
) {
  return (
    !userResult.data.user &&
    (!userResult.error || isMissingRemoteUserError(userResult.error.message))
  );
}

async function restoreSupabaseSession(set: SetAuthState, transitionVersion: number) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (isStaleAuthTransition(transitionVersion)) return;
  const session = data.session;
  if (hasMissingRemoteSession(error, session)) {
    await handleMissingRemoteSession(set, transitionVersion, error?.message);
    return;
  }
  // shouldHandleMissingValidatedUser only clears the local session for missing users
  // matched by isMissingRemoteUserError; unexpected getUser errors fall back to this session.
  const userResult = await supabase.auth.getUser();
  if (isStaleAuthTransition(transitionVersion)) return;
  if (shouldHandleMissingValidatedUser(userResult)) {
    await handleMissingValidatedUser(set, transitionVersion, userResult.error?.message);
    return;
  }
  setRemoteAuthState(set, session);
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

async function signOutLocalQaSession(set: SetAuthState) {
  await clearLocalQaSession().catch(() => undefined);
  await clearOnboardingAndAuthState(set);
  resetAnalyticsUser();
}

function getRemoteSessionUserId(): UserId | null {
  const id = useAuthStore.getState().session?.user?.id;
  return id === undefined ? null : requireUserId(id);
}

function suspendCloudLedgerStateBeforeSignOut(): UserId | null {
  const userId = getRemoteSessionUserId();
  if (userId === null) {
    return null;
  }

  invalidateTransactionSession();
  suspendCloudLedgerRuntimeCacheWrites(userId);
  return userId;
}

async function discardCloudLedgerStateBeforeSignOut(userId: UserId | null): Promise<void> {
  if (userId === null) return;

  try {
    await deleteCloudLedgerTransactionCache(userId);
    await discardCloudLedgerOutbox(userId);
    clearCloudLedgerRuntimeCache(userId);
  } catch (err) {
    resumeCloudLedgerRuntimeCacheWrites(userId);
    resumeTransactionSession(userId);
    captureAuthFailure("auth_signout_cloud_ledger_outbox_discard_failed", err);
    throw err;
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
      const { startLocalQaSession: prepareLocalQaSession } =
        await import("@/features/qa/session-start.public");
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

    const cloudLedgerSignOutUserId = suspendCloudLedgerStateBeforeSignOut();
    // Clean up push token while session is still valid (RLS needs auth).
    // Capped at 2s so signout isn't blocked indefinitely by network issues.
    await cleanupPushTokenBeforeSignOut();
    await discardCloudLedgerStateBeforeSignOut(cloudLedgerSignOutUserId);
    await signOutRemoteSession();
    await clearOnboardingAndAuthState(set);
    resetAnalyticsUser();
  },
}));
