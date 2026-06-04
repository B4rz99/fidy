import { useAuthStore } from "@/features/auth/public";
import { OAuthButton } from "@/features/auth/ui.public";
import { useTranslation } from "@/shared/hooks";
import { isLocalQaAvailable } from "../local-session";

export function LocalQaLoginButton() {
  const { t } = useTranslation();

  if (!isLocalQaAvailable()) return null;

  return (
    <OAuthButton
      icon={null}
      label={t("login.continueInLocalQaMode")}
      testID="login.local-qa"
      onPress={() => {
        void useAuthStore
          .getState()
          .startLocalQaSession()
          .catch(() => undefined);
      }}
      containerClassName=""
      useGlassSurface
      textClassName="text-primary dark:text-primary-dark"
    />
  );
}
