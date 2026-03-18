import { formatCents } from "@/features/transactions";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { ProgressBar } from "./ProgressBar";

type Props = {
  readonly totalBudgetCents: number;
  readonly totalSpentCents: number;
  readonly percentUsed: number;
};

export function BudgetSummaryCard({ totalBudgetCents, totalSpentCents, percentUsed }: Props) {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: secondaryColor }]}>
          {t("budgets.summary.totalBudget")}
        </Text>
        <Text style={[styles.amount, { color: primaryColor }]}>
          {formatCents(totalBudgetCents)}
        </Text>
      </View>

      <ProgressBar percent={percentUsed} />

      <View style={styles.footer}>
        <Text style={[styles.spentText, { color: secondaryColor }]}>
          {formatCents(totalSpentCents)} / {formatCents(totalBudgetCents)}
        </Text>
        <Text style={[styles.usedText, { color: secondaryColor }]}>
          {t("budgets.summary.used", { percent: percentUsed })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 16,
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
    fontSize: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spentText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  usedText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});
