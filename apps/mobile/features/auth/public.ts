import { getOnboardingCompleteFromStore } from "@/features/onboarding/lib/check-onboarding";
import { requireUserId } from "@/shared/types/assertions";
import {
  deriveAccountCreatedAt,
  deriveAuthEmail,
  deriveAuthFullName,
  deriveAuthMode,
  deriveEffectiveOnboardingComplete,
} from "./lib/effective-auth";
import { useAuthStore } from "./store";

export const useAuthMode = () =>
  useAuthStore((state) =>
    deriveAuthMode({ session: state.session, localQaSession: state.localQaSession })
  );

export const useAuthIdentity = () => {
  const fullName = useAuthStore((state) =>
    deriveAuthFullName({ session: state.session, localQaSession: state.localQaSession })
  );
  const email = useAuthStore((state) =>
    deriveAuthEmail({ session: state.session, localQaSession: state.localQaSession })
  );
  const accountCreatedAt = useAuthStore((state) =>
    deriveAccountCreatedAt({ session: state.session, localQaSession: state.localQaSession })
  );

  return { fullName, email, accountCreatedAt };
};

export const useAccountCreatedAt = () =>
  useAuthStore((state) =>
    deriveAccountCreatedAt({ session: state.session, localQaSession: state.localQaSession })
  );

export const useEffectiveOnboardingComplete = () =>
  useAuthStore((state) =>
    deriveEffectiveOnboardingComplete({
      session: state.session,
      localQaSession: state.localQaSession,
      localOnboardingComplete: getOnboardingCompleteFromStore(),
    })
  );

export const useOptionalUserId = () => {
  const userId = useAuthStore(
    (state) =>
      state.localQaSession?.userId ??
      (state.session?.user.id ? requireUserId(state.session.user.id) : null)
  );

  return userId == null ? null : requireUserId(userId);
};
