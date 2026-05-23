import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { CopAmount } from "@/shared/types/branded";
import { deriveBudgetPulseSummaryModel } from "../lib/derive";

type Props = {
  readonly totalBudget: CopAmount;
  readonly totalSpent: CopAmount;
  readonly percentUsed: number;
};

export function BudgetSummaryCard({ totalBudget, totalSpent, percentUsed }: Props) {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const model = deriveBudgetPulseSummaryModel({ totalBudget, totalSpent, percentUsed, t });
  const progressColor = model.isOverBudget ? accentRed : accentGreen;
  const progressWidth = `${Math.max(0, Math.min(percentUsed, 100))}%` as `${number}%`;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: secondaryColor }]}>
          {t("budgets.summary.totalBudget")}
        </Text>
        <View style={[styles.percentPill, { backgroundColor: progressColor }]}>
          <Text style={styles.percentText}>{model.percentLabel}</Text>
        </View>
      </View>

      <Text style={[styles.amount, { color: primaryColor }]}>{model.totalBudgetLabel}</Text>
      <Text style={[styles.guidance, { color: secondaryColor }]}>{model.guidance}</Text>

      <View style={[styles.progressTrack, { backgroundColor: borderColor }]}>
        <View
          style={[styles.progressFill, { backgroundColor: progressColor, width: progressWidth }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 34,
    lineHeight: 40,
  },
  guidance: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  percentPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  percentText: {
    color: "#0D0D0D",
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
  },
  progressTrack: {
    borderRadius: 999,
    height: 9,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: 999,
    height: 9,
  },
});
