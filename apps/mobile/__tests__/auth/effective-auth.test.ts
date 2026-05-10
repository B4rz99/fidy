// biome-ignore-all lint/style/useNamingConvention: Supabase session shape uses snake_case
import { describe, expect, it } from "vitest";
import {
  deriveAccountCreatedAt,
  deriveAuthEmail,
  deriveAuthFullName,
  deriveAuthIdentity,
  deriveAuthMode,
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
    expect(deriveAuthIdentity({ session: remoteSession, localQaSession })).toEqual({
      fullName: "Local QA",
      email: "local-qa@fidy.dev",
      accountCreatedAt: "",
      profileImageUrl: null,
    });
  });

  it("derives provider profile image urls from remote auth metadata", () => {
    expect(
      deriveAuthIdentity({
        session: {
          user: {
            id: "remote-user",
            email: "remote@example.com",
            created_at: "2026-04-19T00:00:00Z",
            user_metadata: {
              full_name: "Remote User",
              avatar_url: "https://accounts.google.com/avatar.png",
            },
          },
        } as never,
        localQaSession: null,
      })
    ).toEqual({
      fullName: "Remote User",
      email: "remote@example.com",
      accountCreatedAt: "2026-04-19T00:00:00Z",
      profileImageUrl: "https://accounts.google.com/avatar.png",
    });

    expect(
      deriveAuthIdentity({
        session: {
          user: {
            id: "remote-user",
            email: "remote@example.com",
            created_at: "2026-04-19T00:00:00Z",
            user_metadata: {
              full_name: "Remote User",
              picture: "https://graph.microsoft.com/avatar.jpg",
            },
          },
        } as never,
        localQaSession: null,
      }).profileImageUrl
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
