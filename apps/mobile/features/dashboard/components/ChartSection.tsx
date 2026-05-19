import { CATEGORY_MAP } from "@/shared/categories";
import { Pressable, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import { CategoryRow } from "./CategoryRow";
import { DonutChart } from "./DonutChart";

type CategorySpendingItem = {
  readonly categoryId: string;
  readonly total: number;
};

type ChartSectionProps = {
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly totalSpent: number;
  readonly onPress?: () => void;
};

const toSegments = (categories: readonly CategorySpendingItem[], totalSpent: number) =>
  categories.map((c) => {
    const cat = CATEGORY_MAP[c.categoryId];
    return {
      percentage: totalSpent === 0 ? 0 : (c.total / totalSpent) * 100,
      color: cat?.color ?? "#B8A9D4",
    };
  });

const toCategoryRows = (categories: readonly CategorySpendingItem[], locale: string) =>
  categories.map((c) => {
    const cat = CATEGORY_MAP[c.categoryId];
    return {
      categoryId: c.categoryId,
      color: cat?.color ?? "#B8A9D4",
      name: cat ? getCategoryLabel(cat, locale) : c.categoryId,
      amount: formatMoney(c.total),
    };
  });

const MAX_VISIBLE_CATEGORIES = 5;
const OTHERS_COLOR = "#6B6B6B";

export const ChartSection = ({ categorySpending, totalSpent, onPress }: ChartSectionProps) => {
  const { t, locale } = useTranslation();

  const visible = categorySpending.slice(0, MAX_VISIBLE_CATEGORIES);
  const remaining = categorySpending.slice(MAX_VISIBLE_CATEGORIES);
  const remainingTotal = remaining.reduce((sum, c) => sum + c.total, 0);

  const visibleSegments = toSegments(visible, totalSpent);
  const segments =
    remaining.length > 0
      ? [
          ...visibleSegments,
          {
            percentage: totalSpent === 0 ? 0 : (remainingTotal / totalSpent) * 100,
            color: OTHERS_COLOR,
          },
        ]
      : visibleSegments;
  const rows = toCategoryRows(visible, locale);

  return (
    <Pressable onPress={onPress} className="rounded-chart bg-chart-bg p-4 dark:bg-chart-bg-dark">
      <View className="flex-row gap-4">
        <DonutChart
          segments={segments}
          centerLabel={formatMoney(totalSpent)}
          centerSubLabel={t("chart.spent")}
        />
        <View className="flex-1 justify-center gap-2.5">
          {rows.map((row) => (
            <CategoryRow
              key={row.categoryId}
              color={row.color}
              name={row.name}
              amount={row.amount}
            />
          ))}
          {remaining.length > 0 && (
            <CategoryRow
              color={OTHERS_COLOR}
              name={t("chart.moreCategories", { count: remaining.length })}
              amount={formatMoney(remainingTotal)}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
};
