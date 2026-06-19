import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthIdentity, useAuthMode, useAuthStore } from "@/features/auth/public";
import { LocalQaProfileTools } from "@/features/qa/routes.public";
import { Button, GlassSurface, ScreenLayout, TextActionButton } from "@/shared/components";
import { LogOut } from "@/shared/components/icons";
import { Alert, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { deriveProfileAvatar } from "../lib/profile-avatar";

export function ProfileScreen() {
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const { fullName, email, profileImageUrl } = useAuthIdentity();
  const authMode = useAuthMode();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const avatar = deriveProfileAvatar({
    fullName,
    email,
    profileImageUrl,
    didImageFail: profileImageUrl === failedImageUrl,
  });

  const accentGreen = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");

  const handleLogOut = () => {
    Alert.alert(t("settings.logoutConfirmTitle"), t("settings.logoutConfirmMessage"), [
      { text: t("settings.staySignedIn"), style: "cancel" },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: () => {
          void useAuthStore.getState().signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    push("/delete-account");
  };

  return (
    <ScreenLayout variant="sub" title={t("settings.profileTitle")} onBack={back}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 32,
          paddingBottom: 40,
        }}
        contentInset={{ bottom }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Avatar & Info */}
        <View className="items-center" style={{ gap: 12 }}>
          <GlassSurface
            radius={40}
            padded={false}
            style={{
              width: 80,
              height: 80,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {avatar.type === "image" ? (
              <Image
                source={{ uri: avatar.uri }}
                style={{ width: 80, height: 80 }}
                contentFit="cover"
                onError={() => setFailedImageUrl(avatar.uri)}
              />
            ) : (
              <Text className="font-poppins-bold" style={{ color: accentGreen, fontSize: 28 }}>
                {avatar.initials}
              </Text>
            )}
          </GlassSurface>
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
          {/* Sign-out button */}
          <Button
            label={t("settings.logout")}
            onPress={handleLogOut}
            variant="secondary"
            icon={<LogOut size={20} color={secondaryColor} />}
            className="w-full rounded-2xl"
          />

          <LocalQaProfileTools />

          {authMode === "remote" ? (
            <TextActionButton
              label={t("settings.deleteAccount")}
              onPress={handleDeleteAccount}
              tone="danger"
              appearance="plain"
            />
          ) : null}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
