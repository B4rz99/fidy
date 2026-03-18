import { FidyLogo } from "@/shared/components";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { useOnboardingStore } from "../store";

export function WelcomeStep() {
  const { t } = useTranslation();
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  const handleAlreadyHaveAccount = () => guardedRun(completeOnboarding);

  return (
    <View style={styles.container}>
      <View style={styles.logoSection}>
        <FidyLogo />
        <Text style={[styles.hero, { color: primaryColor }]}>{t("onboarding.welcome.hero")}</Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          {t("onboarding.welcome.subtitle")}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: accentGreen }]}
          onPress={nextStep}
        >
          <Text style={styles.primaryButtonText}>{t("onboarding.welcome.getStarted")}</Text>
        </Pressable>
        <Pressable onPress={handleAlreadyHaveAccount} disabled={isBusy}>
          <Text style={[styles.linkText, { color: secondaryColor }]}>
            {t("onboarding.welcome.alreadyHaveAccount")}
          </Text>
        </Pressable>
      </View>
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
  logoSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  hero: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    textAlign: "center",
    marginTop: 24,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    alignItems: "center",
    gap: 16,
  },
  primaryButton: {
    borderRadius: 14,
    borderCurve: "continuous",
    paddingVertical: 16,
    alignItems: "center",
    alignSelf: "stretch",
  },
  primaryButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  linkText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
});
