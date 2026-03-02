import { useRouter } from "expo-router";
import { Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppleIcon } from "@/features/auth/components/icons/AppleIcon";
import { GoogleIcon } from "@/features/auth/components/icons/GoogleIcon";
import { MicrosoftIcon } from "@/features/auth/components/icons/MicrosoftIcon";
import { OAuthButton } from "@/features/auth/components/OAuthButton";
import { FidyLogo } from "@/shared/components/FidyLogo";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="flex-1 bg-login-bg dark:bg-login-bg-dark" style={{ paddingTop: insets.top }}>
      <View className="flex-1 justify-center px-8 pb-8 gap-8">
        <View className="h-10" />

        {/* Logo + Tagline */}
        <View className="items-center gap-4">
          <FidyLogo />
          <Text className="font-poppins-medium text-[18px] text-secondary dark:text-secondary-dark">
            your finances, simplified.
          </Text>
        </View>

        {/* OAuth Buttons */}
        <View className="gap-3 w-full">
          <OAuthButton
            icon={<GoogleIcon />}
            label="Continue with Google"
            onPress={() => router.replace("/(tabs)")}
            containerClassName="bg-login-google dark:bg-login-google-dark border border-login-google-border dark:border-login-google-border-dark"
            textClassName="text-primary dark:text-primary-dark"
          />
          <OAuthButton
            icon={<AppleIcon color={isDark ? "#1A1A1A" : "#FFFFFF"} />}
            label="Continue with Apple"
            onPress={() => router.replace("/(tabs)")}
            containerClassName="bg-primary dark:bg-card"
            textClassName="text-card dark:text-primary"
          />
          <OAuthButton
            icon={<MicrosoftIcon />}
            label="Continue with Microsoft"
            onPress={() => router.replace("/(tabs)")}
            containerClassName="bg-login-ms dark:bg-login-ms-dark"
            textClassName="text-primary dark:text-primary-dark"
          />
        </View>

        {/* Legal Text */}
        <Text className="text-center font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          By continuing, you agree to our Terms of Service{"\n"}and Privacy Policy.
        </Text>

        <View className="h-4" />
      </View>
    </View>
  );
}
