import { MetricCard, ProgressBar } from "@/shared/components";
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
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const model = deriveBudgetPulseSummaryModel({ totalBudget, totalSpent, percentUsed, t });
  const progressColor = model.isOverBudget ? accentRed : accentGreen;

  return (
    <MetricCard contentClassName="p-[18px]">
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

      <ProgressBar
        percent={percentUsed}
        height={9}
        fillColor={progressColor}
        completeTone={model.isOverBudget ? "danger" : "success"}
      />
    </MetricCard>
  );
}

const styles = StyleSheet.create({
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
});
