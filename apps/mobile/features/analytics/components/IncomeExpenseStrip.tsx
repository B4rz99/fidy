import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { IncomeExpenseResult } from "../lib/derive";

type IncomeExpenseStripProps = {
  readonly incomeExpense: IncomeExpenseResult;
};

export function IncomeExpenseStrip({ incomeExpense }: IncomeExpenseStripProps) {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const cardBg = useThemeColor("card");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View style={[styles.strip, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
      <View style={styles.legendRow}>
        <Text style={[styles.legendLabel, { color: secondaryColor }]}>
          {t("analytics.incomeLabel")}
        </Text>
        <Text style={[styles.legendValue, { color: primaryColor }]}>
          {formatMoney(incomeExpense.income)}
        </Text>
      </View>
      <View style={styles.legendRow}>
        <Text style={[styles.legendLabel, { color: secondaryColor }]}>
          {t("analytics.expensesLabel")}
        </Text>
        <Text style={[styles.legendValue, { color: primaryColor }]}>
          {formatMoney(incomeExpense.expenses)}
        </Text>
      </View>
      <View style={styles.legendRow}>
        <Text style={[styles.legendLabel, { color: secondaryColor }]}>
          {t("analytics.netLabel")}
        </Text>
        <Text
          style={[
            styles.legendValue,
            { color: incomeExpense.netIsPositive ? accentGreen : accentRed },
          ]}
        >
          {`${incomeExpense.netIsPositive ? "+" : "-"}${formatMoney(Math.abs(incomeExpense.net))}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 7,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  legendLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  legendValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
});
