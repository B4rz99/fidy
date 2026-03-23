import { memo } from "react";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import type { IncomeExpenseResult } from "../lib/derive";

type IncomeExpenseCardProps = {
  readonly data: IncomeExpenseResult;
};

const BAR_HEIGHT = 24;
const LABEL_WIDTH = 60;
const AMOUNT_MIN_WIDTH = 72;

const IncomeExpenseCard = memo(function IncomeExpenseCard({ data }: IncomeExpenseCardProps) {
  const { t } = useTranslation();
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  const { income, expenses, net, netIsPositive } = data;

  const maxValue = Math.max(income, expenses, 1);
  const incomeFlex = income / maxValue;
  const expensesFlex = expenses / maxValue;

  const netPrefix = t("analytics.netPrefix");
  const netSign = netIsPositive ? "+" : "-";
  const netAbsolute = Math.abs(net) as CopAmount;
  const netText = `${netPrefix}${netSign}${formatMoney(netAbsolute)}`;
  const netColor = netIsPositive ? accentGreen : accentRed;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Income row */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: secondaryColor }]}>{t("analytics.incomeLabel")}</Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.bar,
              { backgroundColor: accentGreen, flex: incomeFlex },
            ]}
          />
        </View>
        <Text style={[styles.amountText, { color: accentGreen }]}>
          {formatMoney(income)}
        </Text>
      </View>

      {/* Expense row */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: secondaryColor }]}>
          {t("analytics.expensesLabel")}
        </Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.bar,
              { backgroundColor: accentRed, flex: expensesFlex },
            ]}
          />
        </View>
        <Text style={[styles.amountText, { color: accentRed }]}>
          {formatMoney(expenses)}
        </Text>
      </View>

      {/* Net row */}
      <View style={styles.netRow}>
        <Text style={[styles.netText, { color: netColor }]}>{netText}</Text>
      </View>
    </View>
  );
});

export { IncomeExpenseCard };

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: BAR_HEIGHT,
  },
  label: {
    width: LABEL_WIDTH,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  barContainer: {
    flex: 1,
    flexDirection: "row",
    height: BAR_HEIGHT,
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  amountText: {
    width: AMOUNT_MIN_WIDTH,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    textAlign: "right",
  },
  netRow: {
    alignItems: "center",
  },
  netText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
});
