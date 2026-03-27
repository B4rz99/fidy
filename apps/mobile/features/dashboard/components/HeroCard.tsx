import { memo } from "react";
import { useBudgetStore } from "@/features/budget";
import { ProgressBar } from "@/features/budget/components/ProgressBar";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import type { DashboardPeriod } from "../lib/derive";

type Props = {
  readonly period: DashboardPeriod;
  readonly spentAmount: CopAmount;
};

const PERIOD_LABEL_KEYS: Record<DashboardPeriod, string> = {
  today: "dashboard.spentToday",
  week: "dashboard.spentThisWeek",
  month: "dashboard.spentThisMonth",
};

export const HeroCard = memo(function HeroCard({ period, spentAmount }: Props) {
  const { t } = useTranslation();
  const summary = useBudgetStore((s) => s.summary);
  const chartBg = useThemeColor("chartBg");
  const secondaryColor = useThemeColor("secondary");
  const primaryColor = useThemeColor("primary");

  const percent =
    summary.totalBudget === 0 ? 0 : Math.round((summary.totalSpent / summary.totalBudget) * 100);

  return (
    <View style={[styles.card, { backgroundColor: chartBg }]}>
      <Text style={[styles.overline, { color: secondaryColor }]}>
        {t(PERIOD_LABEL_KEYS[period])}
      </Text>
      <Text style={[styles.amount, { color: primaryColor }]}>{formatMoney(spentAmount)}</Text>
      <ProgressBar percent={percent} height={8} />
      <Text style={[styles.subText, { color: secondaryColor }]}>
        {formatMoney(summary.totalSpent as CopAmount)} /{" "}
        {formatMoney(summary.totalBudget as CopAmount)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 20,
    gap: 8,
  },
  overline: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  amount: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 28,
  },
  subText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    marginTop: 4,
  },
});
