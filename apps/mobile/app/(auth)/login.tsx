import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoogleIcon } from "@/features/auth/components/icons/GoogleIcon";
import { MicrosoftIcon } from "@/features/auth/components/icons/MicrosoftIcon";
import { OAuthButton } from "@/features/auth/components/OAuthButton";
import { useAuthStore } from "@/features/auth/store";
import { FidyLogo } from "@/shared/components/FidyLogo";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const isSigningIn = useAuthStore((s) => s.isSigningIn);

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
        {isSigningIn ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View className="gap-3 w-full">
            <OAuthButton
              icon={<GoogleIcon />}
              label="Continue with Google"
              onPress={() => useAuthStore.getState().signIn("google")}
              containerClassName="bg-login-google dark:bg-login-google-dark border border-login-google-border dark:border-login-google-border-dark"
              textClassName="text-primary dark:text-primary-dark"
            />
            <OAuthButton
              icon={<MicrosoftIcon />}
              label="Continue with Microsoft"
              onPress={() => useAuthStore.getState().signIn("azure")}
              containerClassName="bg-login-ms dark:bg-login-ms-dark"
              textClassName="text-primary dark:text-primary-dark"
            />
          </View>
        )}

        {/* Legal Text */}
        <Text className="text-center font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          By continuing, you agree to our Terms of Service{"\n"}and Privacy Policy.
        </Text>

        <View className="h-4" />
      </View>
    </View>
  );
}
