import Ionicons from "@expo/vector-icons/Ionicons";
import { GoogleIcon, MicrosoftIcon, OAuthButton } from "@/features/auth";
import {
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { useOnboardingStore } from "../store";

export function ConnectEmailStep() {
  const { t } = useTranslation();
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const setEmailSkipped = useOnboardingStore((s) => s.setEmailSkipped);
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const cardBg = useThemeColor("card");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  const handleConnect = (provider: "gmail" | "outlook") =>
    guardedRun(async () => {
      const clientId = provider === "gmail" ? getGmailClientId() : getOutlookClientId();
      await connectEmail(provider, clientId);
      // If accounts were added, auto-advance
      const accounts = useEmailCaptureStore.getState().accounts;
      if (accounts.length > 0) {
        nextStep();
      }
    });

  const handleSkip = () => {
    setEmailSkipped(true);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: accentGreen }]}>
          <Ionicons name="mail" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("onboarding.connectEmail.title")}
        </Text>
        <Text style={[styles.description, { color: secondaryColor }]}>
          {t("onboarding.connectEmail.description")}
        </Text>

        <View style={styles.buttons}>
          <OAuthButton
            icon={<GoogleIcon />}
            label={t("login.continueWithGoogle")}
            onPress={() => {
              void handleConnect("gmail");
            }}
            containerClassName="border border-gray-300 dark:border-gray-600"
            textClassName="text-gray-800 dark:text-gray-200"
          />
          <OAuthButton
            icon={<MicrosoftIcon />}
            label={t("login.continueWithMicrosoft")}
            onPress={() => {
              void handleConnect("outlook");
            }}
            containerClassName="border border-gray-300 dark:border-gray-600"
            textClassName="text-gray-800 dark:text-gray-200"
          />
        </View>

        <View style={[styles.trustBadge, { backgroundColor: cardBg }]}>
          <Ionicons name="shield-checkmark" size={18} color={accentGreen} />
          <Text style={[styles.trustText, { color: secondaryColor }]}>
            {t("onboarding.connectEmail.trustBadge")}
          </Text>
        </View>
      </View>

      <Pressable onPress={handleSkip} disabled={isBusy} style={styles.skipButton}>
        <Text style={[styles.skipText, { color: secondaryColor }]}>
          {t("onboarding.connectEmail.skipForNow")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  description: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  buttons: {
    alignSelf: "stretch",
    gap: 12,
    marginTop: 8,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: "continuous",
    marginTop: 8,
  },
  trustText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
});
