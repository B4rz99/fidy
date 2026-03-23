import { memo } from "react";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { CATEGORY_MAP } from "@/features/transactions";
import { getCategoryLabel } from "@/shared/i18n/locale-helpers";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import type { AnalyticsPeriod, PeriodDelta } from "../lib/derive";

type PeriodDeltaCardProps = {
  readonly period: AnalyticsPeriod;
  readonly data: PeriodDelta;
};

/** Format a delta amount + percent: "+$45.000 (+7%)" or "-$30.000 (-9%)" */
const formatDelta = (delta: CopAmount, deltaPercent: number): string => {
  const sign = delta >= 0 ? "+" : "-";
  const absAmount = Math.abs(delta) as CopAmount;
  const absPercent = Math.abs(deltaPercent);
  return `${sign}${formatMoney(absAmount)} (${sign}${absPercent}%)`;
};

const PeriodDeltaCard = memo(function PeriodDeltaCard({ period, data }: PeriodDeltaCardProps) {
  const { t, locale } = useTranslation();
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  const { totalDeltaPercent, spendingIncreased, categoryDeltas } = data;

  // For spending: increase = bad (red), decrease = good (green)
  const totalColor = spendingIncreased ? accentRed : accentGreen;
  const totalSign = totalDeltaPercent >= 0 ? "+" : "-";
  const totalPercentText = `${totalSign}${Math.abs(totalDeltaPercent)}%`;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <Text style={[styles.title, { color: primaryColor }]}>
        {t(`analytics.vsPreviousPeriod.${period}`)}
      </Text>

      {/* Total spending row */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: secondaryColor }]}>
          {t("analytics.totalSpending")}
        </Text>
        <Text style={[styles.deltaText, { color: totalColor }]}>{totalPercentText}</Text>
      </View>

      {/* Category delta rows */}
      {categoryDeltas.map((item) => {
        const category = CATEGORY_MAP[item.categoryId];
        const label = category ? getCategoryLabel(category, locale) : String(item.categoryId);
        const deltaColor = item.increased ? accentRed : accentGreen;
        const deltaText = formatDelta(item.delta, item.deltaPercent);

        return (
          <View key={item.categoryId} style={styles.row}>
            <Text style={[styles.label, { color: secondaryColor }]} numberOfLines={1}>
              {label}
            </Text>
            <Text style={[styles.deltaText, { color: deltaColor }]}>{deltaText}</Text>
          </View>
        );
      })}
    </View>
  );
});

export { PeriodDeltaCard };

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 16,
    gap: 10,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  deltaText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    textAlign: "right",
  },
});
