// biome-ignore-all lint/style/useNamingConvention: mock exports must match Supabase API names
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/features/auth/store";
import { useLocalOnboardingState } from "@/features/onboarding/lib/local-onboarding-state";

const mockUser = { id: "user-1", email: "test@example.com" };
const mockSession = { user: mockUser, access_token: "token" };
const {
  mockCleanupCurrentPushToken,
  mockLoadLocalQaSession,
  mockStartLocalQaSession,
  mockClearLocalQaSession,
  mockGetOnboardingCompleteFromStore,
  mockClearOnboardingFromStore,
} = vi.hoisted(() => {
  const mockCleanupCurrentPushToken = vi.fn(() => Promise.resolve());
  const mockLoadLocalQaSession = vi.fn<
    () => Promise<{
      userId: string;
      profile: string;
      onboardingComplete: boolean;
      displayName: string;
      email: string;
    } | null>
  >(() => Promise.resolve(null));
  const mockStartLocalQaSession = vi.fn((profile?: string) =>
    Promise.resolve({
      userId: profile === "transfer-ready" ? "qa-local-transfer-ready" : "qa-local-default",
      profile: profile === "transfer-ready" ? "transfer-ready" : "default",
      onboardingComplete: true,
      displayName: profile === "transfer-ready" ? "Local QA Transfer Ready" : "Local QA",
      email:
        profile === "transfer-ready" ? "local-qa+transfer-ready@fidy.dev" : "local-qa@fidy.dev",
    })
  );
  const mockClearLocalQaSession = vi.fn(() => Promise.resolve());
  const mockGetOnboardingCompleteFromStore = vi.fn(() => false);
  const mockClearOnboardingFromStore = vi.fn(() => Promise.resolve());

  return {
    mockCleanupCurrentPushToken,
    mockLoadLocalQaSession,
    mockStartLocalQaSession,
    mockClearLocalQaSession,
    mockGetOnboardingCompleteFromStore,
    mockClearOnboardingFromStore,
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
  const mockSetSession = vi.fn(() =>
    Promise.resolve({ data: { session: hoistedSession }, error: null })
  );
  const mockSignInWithOAuth = vi.fn(() =>
    Promise.resolve({ data: { url: "https://example.com" }, error: null })
  );
  const mockSignOut = vi.fn(() => Promise.resolve({ error: null }));
  const mockGetSession = vi.fn(() => Promise.resolve({ data: { session: null }, error: null }));
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
  maybeCompleteAuthSession: vi.fn(),
}));

vi.mock("@/features/notifications/public", () => ({
  cleanupCurrentPushToken: mockCleanupCurrentPushToken,
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
    expect(mockClearOnboardingFromStore).toHaveBeenCalledOnce();
    expect(useLocalOnboardingState.getState().isComplete).toBe(false);
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
