import { memo } from "react";
import type { CategoryBreakdownItem } from "@/features/analytics/lib/derive";
import { CATEGORY_MAP } from "@/features/transactions";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";

type Props = {
  readonly categories: ReadonlyArray<CategoryBreakdownItem>;
  readonly onPress: () => void;
};

const MAX_VISIBLE = 5;

export const CategoryBarChart = memo(function CategoryBarChart({ categories, onPress }: Props) {
  const { t, locale } = useTranslation();
  const secondaryColor = useThemeColor("secondary");
  const primaryColor = useThemeColor("primary");
  const chartBg = useThemeColor("chartBg");

  const visible = categories.slice(0, MAX_VISIBLE);
  const maxPercent = visible.reduce((max, c) => Math.max(max, c.percent), 0);

  return (
    <Pressable onPress={onPress} style={[styles.container, { backgroundColor: chartBg }]}>
      <Text style={[styles.title, { color: primaryColor }]}>{t("dashboard.byCategory")}</Text>
      <View style={styles.rows}>
        {visible.map((item) => {
          const cat = CATEGORY_MAP[item.categoryId as keyof typeof CATEGORY_MAP];
          const color = cat?.color ?? "#B8A9D4";
          const name = cat ? getCategoryLabel(cat, locale) : item.categoryId;
          const barWidth = maxPercent === 0 ? 0 : (item.percent / maxPercent) * 100;

          return (
            <View key={item.categoryId} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.categoryName, { color: primaryColor }]} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.barContainer}>
                <View style={[styles.bar, { backgroundColor: color, width: `${barWidth}%` }]} />
              </View>
              <Text style={[styles.amount, { color: primaryColor }]}>
                {formatMoney(item.total as CopAmount)}
              </Text>
              <Text style={[styles.percent, { color: secondaryColor }]}>{item.percent}%</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  rows: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    width: 70,
  },
  barContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  amount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    textAlign: "right",
    minWidth: 60,
  },
  percent: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    textAlign: "right",
    minWidth: 30,
  },
});
