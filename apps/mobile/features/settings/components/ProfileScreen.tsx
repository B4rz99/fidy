import { useRouter } from "expo-router";
import { useAuthStore } from "@/features/auth";
import { getUserInitials } from "@/features/settings/lib/settings-links";
import { ScreenLayout } from "@/shared/components";
import { Brain, LogOut } from "@/shared/components/icons";
import { Alert, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const session = useAuthStore((s) => s.session);
  const fullName = session?.user?.user_metadata?.full_name ?? "";
  const email = session?.user?.email ?? "";
  const initials = getUserInitials(fullName, email);

  const accentGreen = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");
  const borderColor = useThemeColor("borderSubtle");

  const handleLogOut = () => {
    Alert.alert(t("settings.logoutConfirmTitle"), t("settings.logoutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: () => useAuthStore.getState().signOut(),
      },
    ]);
  };

  const handleDeleteAccount = () => {
    router.push("/delete-account");
  };

  return (
    <ScreenLayout variant="sub" title={t("settings.profileTitle")} onBack={() => router.back()}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 32,
          paddingBottom: 40,
        }}
      >
        {/* Avatar & Info */}
        <View className="items-center" style={{ gap: 12 }}>
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 80,
              height: 80,
              backgroundColor: accentGreen,
            }}
          >
            <Text className="font-poppins-bold text-white" style={{ fontSize: 28 }}>
              {initials}
            </Text>
          </View>
          <View className="items-center" style={{ gap: 4 }}>
            <Text className="font-poppins-semibold text-lg text-primary dark:text-primary-dark">
              {fullName}
            </Text>
            <Text className="font-poppins text-sm text-secondary dark:text-secondary-dark">
              {email}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={{ gap: 16, marginTop: 32 }} className="items-center">
          {/* AI Memories */}
          <Pressable
            onPress={() => router.push("/ai-memories")}
            className="flex-row items-center justify-center bg-card dark:bg-card-dark rounded-2xl w-full"
            style={{
              height: 52,
              gap: 8,
              borderWidth: 1,
              borderColor: borderColor,
            }}
          >
            <Brain size={20} color={secondaryColor} />
            <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
              {t("aiChat.memories")}
            </Text>
          </Pressable>

          {/* Log Out Button */}
          <Pressable
            onPress={handleLogOut}
            className="flex-row items-center justify-center bg-card dark:bg-card-dark rounded-2xl w-full"
            style={{
              height: 52,
              gap: 8,
              borderWidth: 1,
              borderColor: borderColor,
            }}
          >
            <LogOut size={20} color={secondaryColor} />
            <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
              {t("settings.logout")}
            </Text>
          </Pressable>

          {/* Delete Account Text Button */}
          <Pressable onPress={handleDeleteAccount}>
            <Text className="font-poppins text-sm text-accent-red dark:text-accent-red-dark">
              {t("settings.deleteAccount")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
