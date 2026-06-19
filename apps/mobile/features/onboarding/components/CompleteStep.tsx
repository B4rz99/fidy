import Ionicons from "@expo/vector-icons/Ionicons";
import { useBudgetStore } from "@/features/budget/public";
import { useTransactionStore } from "@/features/transactions/store.public";
import { Button } from "@/shared/components/Button";
import { GlassSurface } from "@/shared/components/GlassSurface";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { useOnboardingStore } from "../store";

export function CompleteStep() {
  const { t } = useTranslation();
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const isCompleting = useOnboardingStore((s) => s.isCompleting);
  const transactionCount = useTransactionStore((s) => s.pages.length);
  const budgetCount = useBudgetStore((s) => s.budgets.length);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  const handleComplete = () => guardedRun(completeOnboarding);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <GlassSurface radius={48} padded={false} style={styles.iconCircle}>
          <Ionicons name="checkmark" size={48} color={accentGreen} />
        </GlassSurface>
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("onboarding.complete.title")}
        </Text>
        <Text style={[styles.stats, { color: secondaryColor }]}>
          {t("onboarding.complete.stats", {
            transactionCount: String(transactionCount),
            budgetCount: String(budgetCount),
          })}
        </Text>
      </View>

      <Button
        label={t("onboarding.complete.goToDashboard")}
        onPress={() => {
          void handleComplete();
        }}
        loading={isBusy || isCompleting}
      />
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
    gap: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    textAlign: "center",
  },
  stats: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
