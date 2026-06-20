import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/features/auth/hooks.public";
import { GoogleIcon, MicrosoftIcon, OAuthButton } from "@/features/auth/ui.public";
import { LocalQaLoginButton } from "@/features/qa/routes.public";
import { AppAuroraBackground, FidyLogo } from "@/shared/components";
import { ActivityIndicator, Text, View } from "@/shared/components/rn";
import { useColorScheme, useTranslation } from "@/shared/hooks";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const isSigningIn = useAuthStore((s) => s.isSigningIn);

  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <AppAuroraBackground isDark={isDark} />
      <View className="flex-1 justify-center px-8 pb-8 gap-8">
        <View className="h-10" />

        {/* Logo + Tagline */}
        <View className="items-center gap-4">
          <FidyLogo />
          <Text className="font-poppins-medium text-[18px] text-secondary dark:text-secondary-dark">
            {t("login.tagline")}
          </Text>
        </View>

        {/* OAuth Buttons */}
        {isSigningIn ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View className="gap-3 w-full">
            <OAuthButton
              icon={<GoogleIcon />}
              label={t("login.continueWithGoogle")}
              testID="login.google"
              onPress={() => {
                void useAuthStore.getState().signIn("google");
              }}
              textClassName="text-primary dark:text-primary-dark"
            />
            <OAuthButton
              icon={<MicrosoftIcon />}
              label={t("login.continueWithMicrosoft")}
              testID="login.microsoft"
              onPress={() => {
                void useAuthStore.getState().signIn("azure");
              }}
              textClassName="text-primary dark:text-primary-dark"
            />
            <LocalQaLoginButton />
          </View>
        )}

        {/* Legal Text */}
        <Text className="text-center font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {t("login.legalText")}
        </Text>

        <View className="h-4" />
      </View>
    </View>
  );
}
