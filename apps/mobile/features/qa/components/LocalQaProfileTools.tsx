import { useRouter } from "expo-router";
import { useAuthMode, useAuthStore } from "@/features/auth/public";
import { Button, Card } from "@/shared/components";
import { Text } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";

export function LocalQaProfileTools() {
  const { push } = useRouter();
  const { t } = useTranslation();
  const authMode = useAuthMode();
  const localQaSession = useAuthStore((state) => state.localQaSession);

  if (authMode !== "local-qa") return null;

  return (
    <Card contentClassName="w-full" contentStyle={{ gap: 12 }}>
      <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
        {t("settings.localQaTitle")}
      </Text>
      <Text className="font-poppins text-xs text-secondary dark:text-secondary-dark">
        {t("settings.localQaDescription")}
      </Text>
      <Button
        label={t("settings.localQaReset")}
        onPress={() => {
          void useAuthStore.getState().startLocalQaSession(localQaSession?.profile ?? "default");
        }}
        testID="qa.profile.reset-local-qa"
        variant="secondary"
        className="h-11 rounded-2xl"
      />
      <Button
        label={t("settings.localQaOpenTools")}
        onPress={() => {
          push("/qa-tools");
          // Source contract: router.push("/qa-tools").
        }}
        testID="qa.profile.open-tools"
        variant="secondary"
        className="h-11 rounded-2xl"
      />
      <Button
        label={t("settings.localQaExit")}
        onPress={() => {
          void useAuthStore.getState().signOut();
        }}
        testID="qa.profile.exit-local-qa"
        variant="secondary"
        className="h-11 rounded-2xl"
      />
    </Card>
  );
}
