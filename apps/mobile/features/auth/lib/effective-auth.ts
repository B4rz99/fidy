import type { Session } from "@supabase/supabase-js";
import type { LocalQaSession } from "@/features/qa/public";
import { requireUserId } from "@/shared/types/assertions";
import type { UserId } from "@/shared/types/branded";

export type AuthMode = "signed-out" | "remote" | "local-qa";

type EffectiveAuthInput = {
  readonly session: Session | null;
  readonly localQaSession: LocalQaSession | null;
};

type EffectiveOnboardingInput = EffectiveAuthInput & {
  readonly localOnboardingComplete: boolean;
};

export function deriveAuthFullName({ session, localQaSession }: EffectiveAuthInput): string {
  if (localQaSession) return localQaSession.displayName;
  return String(session?.user.user_metadata.full_name ?? "");
}

export function deriveAuthEmail({ session, localQaSession }: EffectiveAuthInput): string {
  if (localQaSession) return localQaSession.email;
  return session?.user.email ?? "";
}

export function deriveAccountCreatedAt({ session, localQaSession }: EffectiveAuthInput): string {
  if (localQaSession) return "";
  return session?.user.created_at ?? "";
}

const isHttpsUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("https://");

export function deriveAuthProfileImageUrl(input: EffectiveAuthInput): string | null {
  const imageUrl =
    input.session?.user.user_metadata.avatar_url ?? input.session?.user.user_metadata.picture;
  return input.localQaSession || !isHttpsUrl(imageUrl) ? null : imageUrl;
}

export function deriveAuthMode({ session, localQaSession }: EffectiveAuthInput): AuthMode {
  if (localQaSession) return "local-qa";
  if (session) return "remote";
  return "signed-out";
}

export function deriveEffectiveUserId({
  session,
  localQaSession,
}: EffectiveAuthInput): UserId | null {
  if (localQaSession) return localQaSession.userId;
  if (!session?.user.id) return null;
  return requireUserId(session.user.id);
}

export function deriveAuthIdentity({ session, localQaSession }: EffectiveAuthInput) {
  return {
    fullName: deriveAuthFullName({ session, localQaSession }),
    email: deriveAuthEmail({ session, localQaSession }),
    accountCreatedAt: deriveAccountCreatedAt({ session, localQaSession }),
    profileImageUrl: deriveAuthProfileImageUrl({ session, localQaSession }),
  };
}

export function deriveEffectiveOnboardingComplete(input: EffectiveOnboardingInput) {
  if (input.localQaSession) return input.localQaSession.onboardingComplete;
  return (
    input.localOnboardingComplete || input.session?.user.user_metadata.onboarding_completed === true
  );
}
