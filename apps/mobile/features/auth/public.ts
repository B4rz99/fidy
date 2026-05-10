import { useLocalOnboardingState } from "@/features/onboarding/lib/local-onboarding-state";
import { requireUserId } from "@/shared/types/assertions";
import {
  deriveAccountCreatedAt,
  deriveAuthEmail,
  deriveAuthFullName,
  deriveAuthMode,
  deriveAuthProfileImageUrl,
  deriveEffectiveOnboardingComplete,
} from "./lib/effective-auth";
import { useAuthStore } from "./store";

export { useAuthStore };

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
  const profileImageUrl = useAuthStore((state) =>
    deriveAuthProfileImageUrl({ session: state.session, localQaSession: state.localQaSession })
  );

  return { fullName, email, accountCreatedAt, profileImageUrl };
};

export const useAccountCreatedAt = () =>
  useAuthStore((state) =>
    deriveAccountCreatedAt({ session: state.session, localQaSession: state.localQaSession })
  );

export const useEffectiveOnboardingComplete = () =>
  deriveEffectiveOnboardingComplete({
    session: useAuthStore((state) => state.session),
    localQaSession: useAuthStore((state) => state.localQaSession),
    localOnboardingComplete: useLocalOnboardingState((state) => state.isComplete),
  });

export const useOptionalUserId = () => {
  const userId = useAuthStore(
    (state) =>
      state.localQaSession?.userId ??
      (state.session?.user.id ? requireUserId(state.session.user.id) : null)
  );

  return userId == null ? null : requireUserId(userId);
};
