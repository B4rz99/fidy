// biome-ignore-all lint/style/useNamingConvention: Supabase session shape uses snake_case
import { describe, expect, it } from "vitest";
import {
  deriveAccountCreatedAt,
  deriveAuthEmail,
  deriveAuthFullName,
  deriveAuthMode,
  deriveAuthProfileImageUrl,
  deriveEffectiveOnboardingComplete,
  deriveEffectiveUserId,
} from "@/features/auth/lib/effective-auth";

describe("effective auth", () => {
  const remoteSession = {
    user: {
      id: "remote-user",
      email: "remote@example.com",
      created_at: "2026-04-19T00:00:00Z",
      user_metadata: { full_name: "Remote User", onboarding_completed: false },
    },
  } as never;

  const localQaSession = {
    userId: "qa-local-default" as never,
    profile: "default" as const,
    onboardingComplete: true,
    displayName: "Local QA",
    email: "local-qa@fidy.dev",
  };

  const remoteSessionWithMetadata = (userMetadata: Record<string, unknown>) =>
    ({
      user: {
        id: "remote-user",
        email: "remote@example.com",
        created_at: "2026-04-19T00:00:00Z",
        user_metadata: { full_name: "Remote User", ...userMetadata },
      },
    }) as never;

  it("prefers the local QA user id when local QA mode is active", () => {
    expect(
      deriveEffectiveUserId({
        session: remoteSession,
        localQaSession,
      })
    ).toBe("qa-local-default");
  });

  it("derives auth mode from the local QA session presence", () => {
    expect(deriveAuthMode({ session: remoteSession, localQaSession })).toBe("local-qa");
    expect(deriveAuthMode({ session: remoteSession, localQaSession: null })).toBe("remote");
  });

  it("uses local QA identity fields when local QA mode is active", () => {
    expect(deriveAuthFullName({ session: remoteSession, localQaSession })).toBe("Local QA");
    expect(deriveAuthEmail({ session: remoteSession, localQaSession })).toBe("local-qa@fidy.dev");
    expect(deriveAccountCreatedAt({ session: remoteSession, localQaSession })).toBe("");
    expect(deriveAuthProfileImageUrl({ session: remoteSession, localQaSession })).toBeNull();
  });

  it("derives provider profile image urls from remote auth metadata", () => {
    expect(
      deriveAuthProfileImageUrl({
        session: remoteSessionWithMetadata({
          avatar_url: "https://accounts.google.com/avatar.png",
        }),
        localQaSession: null,
      })
    ).toBe("https://accounts.google.com/avatar.png");

    expect(
      deriveAuthProfileImageUrl({
        session: remoteSessionWithMetadata({
          picture: "https://graph.microsoft.com/avatar.jpg",
        }),
        localQaSession: null,
      })
    ).toBe("https://graph.microsoft.com/avatar.jpg");

    expect(
      deriveAuthProfileImageUrl({
        session: remoteSessionWithMetadata({
          avatar_url: "http://example.com/insecure.png",
          picture: "https://graph.microsoft.com/avatar.jpg",
        }),
        localQaSession: null,
      })
    ).toBe("https://graph.microsoft.com/avatar.jpg");
  });

  it("derives stable primitive identity fields for local QA mode", () => {
    expect(deriveAuthFullName({ session: remoteSession, localQaSession })).toBe("Local QA");
    expect(deriveAuthEmail({ session: remoteSession, localQaSession })).toBe("local-qa@fidy.dev");
    expect(deriveAccountCreatedAt({ session: remoteSession, localQaSession })).toBe("");
  });

  it("derives onboarding completion from local QA mode before remote session state", () => {
    expect(
      deriveEffectiveOnboardingComplete({
        session: remoteSession,
        localQaSession,
        localOnboardingComplete: false,
      })
    ).toBe(true);
  });
});
