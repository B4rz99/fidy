// biome-ignore-all lint/style/useNamingConvention: mock exports must match Supabase API names
import * as Sentry from "@sentry/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/features/auth/store";
import { useLocalOnboardingState } from "@/features/onboarding/lib/local-onboarding-state";

const mockUser = { id: "user-1", email: "test@example.com" };
const mockSession = { user: mockUser, access_token: "token" };
const {
  mockClearCloudLedgerRuntimeCache,
  mockCleanupCurrentPushToken,
  mockDiscardCloudLedgerOutbox,
  mockDeleteCloudLedgerTransactionCache,
  mockInvalidateTransactionSession,
  mockResumeTransactionSession,
  mockResumeCloudLedgerRuntimeCacheWrites,
  mockSuspendCloudLedgerRuntimeCacheWrites,
  mockLoadLocalQaSession,
  mockStartLocalQaSession,
  mockClearLocalQaSession,
  mockGetOnboardingCompleteFromStore,
  mockClearOnboardingFromStore,
  mockResetDbForUser,
} = vi.hoisted(() => {
  const mockClearCloudLedgerRuntimeCache = vi.fn<(...args: any[]) => any>();
  const mockCleanupCurrentPushToken = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
  const mockDiscardCloudLedgerOutbox = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
  const mockDeleteCloudLedgerTransactionCache = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve()
  );
  const mockInvalidateTransactionSession = vi.fn<(...args: any[]) => any>();
  const mockResumeTransactionSession = vi.fn<(...args: any[]) => any>();
  const mockResumeCloudLedgerRuntimeCacheWrites = vi.fn<(...args: any[]) => any>();
  const mockSuspendCloudLedgerRuntimeCacheWrites = vi.fn<(...args: any[]) => any>();
  const mockLoadLocalQaSession = vi.fn<
    () => Promise<{
      userId: string;
      profile: string;
      onboardingComplete: boolean;
      displayName: string;
      email: string;
    } | null>
  >(() => Promise.resolve(null));
  const mockStartLocalQaSession = vi.fn<(...args: any[]) => any>((profile?: string) =>
    Promise.resolve({
      userId: profile === "transfer-ready" ? "qa-local-transfer-ready" : "qa-local-default",
      profile: profile === "transfer-ready" ? "transfer-ready" : "default",
      onboardingComplete: true,
      displayName: profile === "transfer-ready" ? "Local QA Transfer Ready" : "Local QA",
      email:
        profile === "transfer-ready" ? "local-qa+transfer-ready@fidy.dev" : "local-qa@fidy.dev",
    })
  );
  const mockClearLocalQaSession = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
  const mockGetOnboardingCompleteFromStore = vi.fn<(...args: any[]) => any>(() => false);
  const mockClearOnboardingFromStore = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
  const mockResetDbForUser = vi.fn<(...args: any[]) => any>(() => Promise.resolve());

  return {
    mockClearCloudLedgerRuntimeCache,
    mockCleanupCurrentPushToken,
    mockDiscardCloudLedgerOutbox,
    mockDeleteCloudLedgerTransactionCache,
    mockInvalidateTransactionSession,
    mockResumeTransactionSession,
    mockResumeCloudLedgerRuntimeCacheWrites,
    mockSuspendCloudLedgerRuntimeCacheWrites,
    mockLoadLocalQaSession,
    mockStartLocalQaSession,
    mockClearLocalQaSession,
    mockGetOnboardingCompleteFromStore,
    mockClearOnboardingFromStore,
    mockResetDbForUser,
  };
});

const {
  mockSetSession,
  mockSignInWithOAuth,
  mockSignOut,
  mockGetSession,
  mockGetUser,
  supabaseAuthMock,
} = vi.hoisted(() => {
  const hoistedSession = {
    user: { id: "user-1", email: "test@example.com" },
    access_token: "token",
  };
  const mockSetSession = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ data: { session: hoistedSession }, error: null })
  );
  const mockSignInWithOAuth = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ data: { url: "https://example.com" }, error: null })
  );
  const mockSignOut = vi.fn<(...args: any[]) => any>(() => Promise.resolve({ error: null }));
  const mockGetSession = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ data: { session: null }, error: null })
  );
  const mockGetUser = vi.fn<
    () => Promise<{
      data: { user: typeof hoistedSession.user | null };
      error: { message: string } | null;
    }>
  >(() => Promise.resolve({ data: { user: hoistedSession.user }, error: null }));
  const supabaseAuthMock = {
    getSession: mockGetSession,
    getUser: mockGetUser,
    signInWithOAuth: mockSignInWithOAuth,
    signOut: mockSignOut,
    setSession: mockSetSession,
  };

  return {
    mockSetSession,
    mockSignInWithOAuth,
    mockSignOut,
    mockGetSession,
    mockGetUser,
    supabaseAuthMock,
  };
});

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: () => ({ auth: supabaseAuthMock }),
}));

vi.mock("@/shared/db/client", () => ({
  resetDbForUser: mockResetDbForUser,
}));

const mockOpenAuthSession = vi.fn<
  (url: string, redirect: string) => Promise<{ type: string; url?: string }>
>(() =>
  Promise.resolve({
    type: "success",
    url: "fidy://auth/callback#access_token=tok&refresh_token=ref",
  })
);

vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: (url: string, redirect: string) => mockOpenAuthSession(url, redirect),
  maybeCompleteAuthSession: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/notifications/public", () => ({
  cleanupCurrentPushToken: mockCleanupCurrentPushToken,
}));

vi.mock("@/features/cloud-ledger/runtime.public", () => ({
  clearCloudLedgerRuntimeCache: mockClearCloudLedgerRuntimeCache,
  resumeCloudLedgerRuntimeCacheWrites: mockResumeCloudLedgerRuntimeCacheWrites,
  suspendCloudLedgerRuntimeCacheWrites: mockSuspendCloudLedgerRuntimeCacheWrites,
}));

vi.mock("@/features/cloud-ledger/outbox.public", () => ({
  discardCloudLedgerOutbox: mockDiscardCloudLedgerOutbox,
}));

vi.mock("@/features/transactions/store.public", () => ({
  deleteCloudLedgerTransactionCache: mockDeleteCloudLedgerTransactionCache,
  invalidateTransactionSession: mockInvalidateTransactionSession,
  resumeTransactionSession: mockResumeTransactionSession,
}));

vi.mock("@/features/qa/local-session", () => ({
  loadLocalQaSession: mockLoadLocalQaSession,
  clearLocalQaSession: mockClearLocalQaSession,
}));

vi.mock("@/features/qa/start-local-qa-session", () => ({
  startLocalQaSession: mockStartLocalQaSession,
}));

vi.mock("@/features/onboarding/lib/check-onboarding", () => ({
  getOnboardingCompleteFromStore: () => mockGetOnboardingCompleteFromStore(),
  clearOnboardingFromStore: () => mockClearOnboardingFromStore(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      session: null,
      localQaSession: null,
      isLoading: true,
      isSigningIn: false,
    });
    useLocalOnboardingState.setState({ isComplete: false });
  });

  it("starts with no session and loading true", () => {
    const { session, localQaSession, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(true);
  });

  it("restoreSession prefers a persisted local QA session over Supabase", async () => {
    mockLoadLocalQaSession.mockResolvedValueOnce({
      userId: "qa-local-default",
      profile: "default",
      onboardingComplete: true,
      displayName: "Local QA",
      email: "local-qa@fidy.dev",
    });

    await useAuthStore.getState().restoreSession();

    const { session, localQaSession, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toMatchObject({
      userId: "qa-local-default",
      onboardingComplete: true,
    });
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("restoreSession sets session when one exists", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as never);
    await useAuthStore.getState().restoreSession();

    const { session, localQaSession, isLoading } = useAuthStore.getState();
    expect(session).toEqual(mockSession);
    expect(session?.user).toEqual(mockUser);
    expect(localQaSession).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("restoreSession clears a cached session that Supabase no longer recognizes", async () => {
    useLocalOnboardingState.setState({ isComplete: true });
    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as never);
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User from sub claim in JWT does not exist" },
    });

    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockInvalidateTransactionSession).toHaveBeenCalledOnce();
    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockDeleteCloudLedgerTransactionCache).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).toHaveBeenCalledWith("user-1");
    expect(mockClearOnboardingFromStore).toHaveBeenCalledOnce();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("restoreSession stays signed in when missing-user local database cannot be opened", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
      isLoading: true,
    });
    useLocalOnboardingState.setState({ isComplete: true });
    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as never);
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User from sub claim in JWT does not exist" },
    });
    mockDeleteCloudLedgerTransactionCache.mockRejectedValueOnce(new Error("db decryption failed"));

    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toEqual(mockSession);
    expect(isLoading).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearOnboardingFromStore).not.toHaveBeenCalled();
    expect(useLocalOnboardingState.getState().isComplete).toBe(true);
    expect(mockDiscardCloudLedgerOutbox).not.toHaveBeenCalled();
    expect(mockClearCloudLedgerRuntimeCache).not.toHaveBeenCalled();
    expect(mockResumeCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockResumeTransactionSession).toHaveBeenCalledWith("user-1");
  });

  it("restoreSession preserves cached session on transient getUser errors", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as never);
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Network request failed" },
    });

    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toEqual(mockSession);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearOnboardingFromStore).not.toHaveBeenCalled();
    expect(isLoading).toBe(false);
  });

  it("restoreSession clears the local onboarding flag when no session exists", async () => {
    useLocalOnboardingState.setState({ isComplete: true });

    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(mockClearOnboardingFromStore).toHaveBeenCalledOnce();
    expect(isLoading).toBe(false);
  });

  it("restoreSession sets isLoading false when getSession throws", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("corrupt store"));

    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("startLocalQaSession persists a local QA session and clears remote session state", async () => {
    await useAuthStore.getState().startLocalQaSession();

    const { session, localQaSession, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toMatchObject({
      userId: "qa-local-default",
      profile: "default",
    });
    expect(mockStartLocalQaSession).toHaveBeenCalledOnce();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("startLocalQaSession can switch to a named local QA profile", async () => {
    await useAuthStore.getState().startLocalQaSession("transfer-ready");

    const { session, localQaSession } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toMatchObject({
      userId: "qa-local-transfer-ready",
      profile: "transfer-ready",
    });
    expect(mockStartLocalQaSession).toHaveBeenCalledWith("transfer-ready");
  });

  it("startLocalQaSession rethrows after clearing loading state when local QA preparation fails", async () => {
    mockStartLocalQaSession.mockRejectedValueOnce(new Error("seed failed"));

    await expect(useAuthStore.getState().startLocalQaSession()).rejects.toThrow("seed failed");

    const { session, localQaSession, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("restoreSession does not overwrite a newer local QA session when its request completes late", async () => {
    const deferredRemoteSession = createDeferred<{
      data: { session: typeof mockSession | null };
      error: null;
    }>();

    mockGetSession.mockImplementationOnce(() => deferredRemoteSession.promise as never);

    const restorePromise = useAuthStore.getState().restoreSession();

    await Promise.resolve();
    await useAuthStore.getState().startLocalQaSession("transfer-ready");

    deferredRemoteSession.resolve({
      data: { session: mockSession },
      error: null,
    });

    await restorePromise;

    const { session, localQaSession, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toMatchObject({
      userId: "qa-local-transfer-ready",
      profile: "transfer-ready",
    });
    expect(isLoading).toBe(false);
  });

  it("signIn calls signInWithOAuth with skipBrowserRedirect", async () => {
    await useAuthStore.getState().signIn("google");
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: expect.objectContaining({ skipBrowserRedirect: true }),
      })
    );
  });

  it("signIn opens browser, extracts tokens, and sets session", async () => {
    await useAuthStore.getState().signIn("google");

    expect(mockOpenAuthSession).toHaveBeenCalledWith("https://example.com", "fidy://auth/callback");
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "tok",
      refresh_token: "ref",
    });
    const { session } = useAuthStore.getState();
    expect(session).toEqual(mockSession);
  });

  it("signIn logs and skips session when Supabase rejects the provider token exchange", async () => {
    mockSetSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "invalid refresh token" },
    });

    await useAuthStore.getState().signIn("google");

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "tok",
      refresh_token: "ref",
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith("auth_provider_session_exchange_failed");
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("signIn sets isSigningIn during flow and resets after", async () => {
    const promise = useAuthStore.getState().signIn("google");
    expect(useAuthStore.getState().isSigningIn).toBe(true);
    await promise;
    expect(useAuthStore.getState().isSigningIn).toBe(false);
  });

  it("signIn does not extract tokens when browser is dismissed", async () => {
    mockOpenAuthSession.mockResolvedValueOnce({ type: "dismiss" } as never);

    await useAuthStore.getState().signIn("google");

    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("signIn rejects callback URLs that do not match the registered redirect URI", async () => {
    mockOpenAuthSession.mockResolvedValueOnce({
      type: "success",
      url: "fidy://evil/callback#access_token=tok&refresh_token=ref",
    });

    await useAuthStore.getState().signIn("google");

    expect(mockSetSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("signIn rejects callback URLs on a different port", async () => {
    mockOpenAuthSession.mockResolvedValueOnce({
      type: "success",
      url: "fidy://auth:123/callback#access_token=tok&refresh_token=ref",
    });

    await useAuthStore.getState().signIn("google");

    expect(mockSetSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("signIn rejects empty callback tokens", async () => {
    mockOpenAuthSession.mockResolvedValueOnce({
      type: "success",
      url: "fidy://auth/callback#access_token=&refresh_token=ref",
    });

    await useAuthStore.getState().signIn("google");

    expect(mockSetSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("signOut clears session", async () => {
    useAuthStore.setState({
      session: { access_token: "token" } as never,
      localQaSession: null,
    });
    useLocalOnboardingState.setState({ isComplete: true });

    await useAuthStore.getState().signOut();

    const { session } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(mockClearOnboardingFromStore).toHaveBeenCalledOnce();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("signOut discards the current user's Cloud Ledger outbox and runtime state", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });

    await useAuthStore.getState().signOut();

    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).toHaveBeenCalledWith("user-1");
  });

  it("signOut suspends Cloud Ledger runtime writes before awaiting outbox discard", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });

    await useAuthStore.getState().signOut();

    expect(mockInvalidateTransactionSession).toHaveBeenCalledOnce();
    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockDeleteCloudLedgerTransactionCache).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).toHaveBeenCalledWith("user-1");
    expect(mockResumeCloudLedgerRuntimeCacheWrites).not.toHaveBeenCalled();
    expect(mockInvalidateTransactionSession.mock.invocationCallOrder[0]!).toBeLessThan(
      mockSuspendCloudLedgerRuntimeCacheWrites.mock.invocationCallOrder[0]!
    );
    expect(mockSuspendCloudLedgerRuntimeCacheWrites.mock.invocationCallOrder[0]!).toBeLessThan(
      mockDeleteCloudLedgerTransactionCache.mock.invocationCallOrder[0]!
    );
    expect(mockDeleteCloudLedgerTransactionCache.mock.invocationCallOrder[0]!).toBeLessThan(
      mockDiscardCloudLedgerOutbox.mock.invocationCallOrder[0]!
    );
    expect(mockDiscardCloudLedgerOutbox.mock.invocationCallOrder[0]!).toBeLessThan(
      mockClearCloudLedgerRuntimeCache.mock.invocationCallOrder[0]!
    );
  });

  it("signOut suspends Cloud Ledger runtime writes before awaiting push-token cleanup", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });
    const pushTokenCleanup = createDeferred<void>();
    mockCleanupCurrentPushToken.mockReturnValueOnce(pushTokenCleanup.promise);

    const signOut = useAuthStore.getState().signOut();
    await Promise.resolve();

    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockCleanupCurrentPushToken).toHaveBeenCalledOnce();
    expect(mockSuspendCloudLedgerRuntimeCacheWrites.mock.invocationCallOrder[0]!).toBeLessThan(
      mockCleanupCurrentPushToken.mock.invocationCallOrder[0]!
    );

    pushTokenCleanup.resolve();
    await signOut;
  });

  it("signOut does not complete when Cloud Ledger outbox discard fails", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });
    mockDiscardCloudLedgerOutbox.mockRejectedValueOnce(new Error("secure store delete failed"));

    await expect(useAuthStore.getState().signOut()).rejects.toThrow("secure store delete failed");

    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockResumeCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockResumeTransactionSession).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(mockSession);
  });

  it("signOut discards raw Cloud Ledger outbox state after local cache cleanup handles unreadable state", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });
    mockDeleteCloudLedgerTransactionCache.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().signOut();

    expect(mockDeleteCloudLedgerTransactionCache).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).toHaveBeenCalledWith("user-1");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("signOut preserves auth and outbox state when the local database cannot be opened", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });
    mockDeleteCloudLedgerTransactionCache.mockRejectedValueOnce(new Error("db decryption failed"));

    await expect(useAuthStore.getState().signOut()).rejects.toThrow("db decryption failed");

    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).not.toHaveBeenCalled();
    expect(mockClearCloudLedgerRuntimeCache).not.toHaveBeenCalled();
    expect(mockResumeCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockResumeTransactionSession).toHaveBeenCalledWith("user-1");
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(mockSession);
  });

  it("account-deletion signout resets local auth after remote deletion when the local database cannot be opened", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });
    useLocalOnboardingState.setState({ isComplete: true });
    mockDeleteCloudLedgerTransactionCache.mockRejectedValueOnce(new Error("db decryption failed"));

    await useAuthStore.getState().completeDeletedAccountSignOut();

    expect(mockInvalidateTransactionSession).toHaveBeenCalledOnce();
    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockDeleteCloudLedgerTransactionCache).toHaveBeenCalledWith("user-1");
    expect(mockResetDbForUser).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).toHaveBeenCalledWith("user-1");
    expect(mockResumeCloudLedgerRuntimeCacheWrites).not.toHaveBeenCalled();
    expect(mockResumeTransactionSession).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockClearOnboardingFromStore).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
  });

  it("account-deletion signout preserves local auth when database reset fails after remote deletion", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });
    useLocalOnboardingState.setState({ isComplete: true });
    mockResetDbForUser.mockRejectedValueOnce(new Error("db file delete failed"));

    await expect(useAuthStore.getState().completeDeletedAccountSignOut()).rejects.toThrow(
      "db file delete failed"
    );

    expect(mockInvalidateTransactionSession).toHaveBeenCalledOnce();
    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockDeleteCloudLedgerTransactionCache).toHaveBeenCalledWith("user-1");
    expect(mockResetDbForUser).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).toHaveBeenCalledWith("user-1");
    expect(mockResumeCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockResumeTransactionSession).toHaveBeenCalledWith("user-1");
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearOnboardingFromStore).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(mockSession);
    expect(useLocalOnboardingState.getState().isComplete).toBe(true);
  });

  it("account-deletion signout preserves local auth when outbox discard fails after remote deletion", async () => {
    useAuthStore.setState({
      session: mockSession as never,
      localQaSession: null,
    });
    useLocalOnboardingState.setState({ isComplete: true });
    mockDiscardCloudLedgerOutbox.mockRejectedValueOnce(new Error("secure store delete failed"));

    await expect(useAuthStore.getState().completeDeletedAccountSignOut()).rejects.toThrow(
      "secure store delete failed"
    );

    expect(mockInvalidateTransactionSession).toHaveBeenCalledOnce();
    expect(mockSuspendCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockDeleteCloudLedgerTransactionCache).toHaveBeenCalledWith("user-1");
    expect(mockResetDbForUser).toHaveBeenCalledWith("user-1");
    expect(mockDiscardCloudLedgerOutbox).toHaveBeenCalledWith("user-1");
    expect(mockClearCloudLedgerRuntimeCache).toHaveBeenCalledWith("user-1");
    expect(mockResumeCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith("user-1");
    expect(mockResumeTransactionSession).toHaveBeenCalledWith("user-1");
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearOnboardingFromStore).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(mockSession);
    expect(useLocalOnboardingState.getState().isComplete).toBe(true);
  });

  it("signOut clears state even if supabase.signOut fails", async () => {
    useAuthStore.setState({
      session: { access_token: "token" } as never,
      localQaSession: null,
    });
    useLocalOnboardingState.setState({ isComplete: true });
    mockSignOut.mockRejectedValueOnce(new Error("network error"));

    await useAuthStore.getState().signOut();

    const { session } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
  });

  it("signOut clears local QA state without hitting remote cleanup", async () => {
    useAuthStore.setState({
      session: null,
      localQaSession: {
        userId: "qa-local-default" as never,
        profile: "default",
        onboardingComplete: true,
        displayName: "Local QA",
        email: "local-qa@fidy.dev",
      },
    });
    useLocalOnboardingState.setState({ isComplete: true });

    await useAuthStore.getState().signOut();

    const { session, localQaSession } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(mockClearOnboardingFromStore).toHaveBeenCalledOnce();
    expect(mockClearLocalQaSession).toHaveBeenCalledOnce();
    expect(mockCleanupCurrentPushToken).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("signOut clears loading state when it interrupts a pending restoreSession", async () => {
    const deferredRemoteSession = createDeferred<{
      data: { session: typeof mockSession | null };
      error: null;
    }>();

    mockGetSession.mockImplementationOnce(() => deferredRemoteSession.promise as never);

    const restorePromise = useAuthStore.getState().restoreSession();

    await Promise.resolve();
    const signOutPromise = useAuthStore.getState().signOut();

    deferredRemoteSession.resolve({
      data: { session: null },
      error: null,
    });

    await Promise.all([restorePromise, signOutPromise]);

    const { session, localQaSession, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(localQaSession).toBeNull();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
    expect(isLoading).toBe(false);
  });
});
