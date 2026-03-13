// biome-ignore-all lint/style/useNamingConvention: mock exports must match Supabase API names
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/features/auth/store";

const mockUser = { id: "user-1", email: "test@example.com" };
const mockSession = { user: mockUser, access_token: "token" };

const mockSetSession = vi.fn(() =>
  Promise.resolve({ data: { session: mockSession }, error: null })
);
const mockSignInWithOAuth = vi.fn(() =>
  Promise.resolve({ data: { url: "https://example.com" }, error: null })
);
const mockSignOut = vi.fn(() => Promise.resolve({ error: null }));
const mockGetSession = vi.fn(() => Promise.resolve({ data: { session: null }, error: null }));

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: mockGetSession,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      setSession: mockSetSession,
    },
  }),
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

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      session: null,
      isLoading: true,
      isSigningIn: false,
    });
  });

  it("starts with no session and loading true", () => {
    const { session, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(isLoading).toBe(true);
  });

  it("restoreSession sets session when one exists", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as never);

    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toEqual(mockSession);
    expect(session?.user).toEqual(mockUser);
    expect(isLoading).toBe(false);
  });

  it("restoreSession sets isLoading false when no session", async () => {
    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(isLoading).toBe(false);
  });

  it("restoreSession sets isLoading false when getSession throws", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("corrupt store"));

    await useAuthStore.getState().restoreSession();

    const { session, isLoading } = useAuthStore.getState();
    expect(session).toBeNull();
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

  it("signOut clears session", async () => {
    useAuthStore.setState({
      session: { access_token: "token" } as never,
    });

    await useAuthStore.getState().signOut();

    const { session } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("signOut clears state even if supabase.signOut fails", async () => {
    useAuthStore.setState({
      session: { access_token: "token" } as never,
    });
    mockSignOut.mockRejectedValueOnce(new Error("network error"));

    await useAuthStore.getState().signOut();

    const { session } = useAuthStore.getState();
    expect(session).toBeNull();
  });
});
