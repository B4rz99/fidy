import { memo } from "react";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { CATEGORY_MAP } from "@/features/transactions";
import { getCategoryLabel } from "@/shared/i18n/locale-helpers";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CategoryBreakdownItem } from "../lib/derive";

type CategoryBreakdownCardProps = {
  readonly data: ReadonlyArray<CategoryBreakdownItem>;
};

const BAR_HEIGHT = 16;
const LABEL_WIDTH = 80;
const PERCENT_WIDTH = 32;

const CategoryBreakdownCard = memo(function CategoryBreakdownCard({
  data,
}: CategoryBreakdownCardProps) {
  const { t, locale } = useTranslation();
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <Text style={[styles.title, { color: primaryColor }]}>
        {t("analytics.spendingByCategory")}
      </Text>
      {data.map((item) => {
        const category = CATEGORY_MAP[item.categoryId];
        const label = category ? getCategoryLabel(category, locale) : String(item.categoryId);
        const color = category?.color ?? "#999";
        const barFlex = Math.max(item.percent / 100, 0.02);

        return (
          <View key={item.categoryId} style={styles.row}>
            {/* Dot */}
            <View style={[styles.dot, { backgroundColor: color }]} />

            {/* Label */}
            <Text style={[styles.label, { color: secondaryColor }]} numberOfLines={1}>
              {label}
            </Text>

            {/* Bar */}
            <View style={styles.barContainer}>
              <View style={[styles.bar, { backgroundColor: color, flex: barFlex }]} />
              <View style={{ flex: 1 - barFlex }} />
            </View>

            {/* Amount */}
            <Text style={[styles.amount, { color: primaryColor }]}>
              {formatMoney(item.total)}
            </Text>

            {/* Percent */}
            <Text style={[styles.percent, { color: tertiaryColor }]}>{item.percent}%</Text>
          </View>
        );
      })}
    </View>
  );
});

export { CategoryBreakdownCard };

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
    height: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    borderRadius: 8,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: 8,
    borderCurve: "continuous",
  },
  amount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    textAlign: "right",
    minWidth: 60,
  },
  percent: {
    width: PERCENT_WIDTH,
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    textAlign: "right",
  },
});
