import { Button, FidyLogo } from "@/shared/components";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { useOnboardingStore } from "../store";

export function WelcomeStep() {
  const { t } = useTranslation();
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

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
        <Button label={t("onboarding.welcome.getStarted")} onPress={nextStep} />
        <Pressable
          onPress={() => {
            void handleAlreadyHaveAccount();
          }}
          disabled={isBusy}
        >
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
  linkText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
});
