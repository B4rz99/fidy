import { OAuthButton, useAuthStore } from "@/features/auth";
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
      containerClassName="bg-card dark:bg-card-dark border border-border-subtle dark:border-border-subtle-dark"
      textClassName="text-primary dark:text-primary-dark"
    />
  );
}
