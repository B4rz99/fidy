import { useRouter } from "expo-router";
import { useAuthMode, useAuthStore } from "@/features/auth/public";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function LocalQaProfileTools() {
  const router = useRouter();
  const { t } = useTranslation();
  const authMode = useAuthMode();
  const localQaSession = useAuthStore((state) => state.localQaSession);
  const borderColor = useThemeColor("borderSubtle");

  if (authMode !== "local-qa") return null;

  return (
    <View
      className="w-full rounded-2xl bg-card dark:bg-card-dark"
      style={{ gap: 12, padding: 16, borderWidth: 1, borderColor }}
    >
      <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
        {t("settings.localQaTitle")}
      </Text>
      <Text className="font-poppins text-xs text-secondary dark:text-secondary-dark">
        {t("settings.localQaDescription")}
      </Text>
      <Pressable
        onPress={() => {
          void useAuthStore.getState().startLocalQaSession(localQaSession?.profile ?? "default");
        }}
        testID="qa.profile.reset-local-qa"
        className="items-center justify-center rounded-2xl bg-page dark:bg-page-dark"
        style={{ height: 44 }}
      >
        <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
          {t("settings.localQaReset")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          router.push("/qa-tools");
        }}
        testID="qa.profile.open-tools"
        className="items-center justify-center rounded-2xl bg-page dark:bg-page-dark"
        style={{ height: 44 }}
      >
        <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
          {t("settings.localQaOpenTools")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void useAuthStore.getState().signOut();
        }}
        testID="qa.profile.exit-local-qa"
        className="items-center justify-center rounded-2xl bg-page dark:bg-page-dark"
        style={{ height: 44 }}
      >
        <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
          {t("settings.localQaExit")}
        </Text>
      </Pressable>
    </View>
  );
}
