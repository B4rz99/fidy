import { useCallback, useState } from "react";
import { CATEGORY_MAP } from "@/features/transactions";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import { CategoryRow } from "./CategoryRow";
import { DonutChart } from "./DonutChart";
import { SpendingLineChart } from "./SpendingLineChart";

type CategorySpendingItem = {
  readonly categoryId: string;
  readonly total: number;
};

type DailySpendingItem = {
  readonly date: string;
  readonly total: number;
};

type ChartSectionProps = {
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly dailySpending: readonly DailySpendingItem[];
  readonly totalSpent: number;
  readonly onPress?: () => void;
};

const toSegments = (categories: readonly CategorySpendingItem[], totalSpent: number) =>
  categories.map((c) => {
    const cat = CATEGORY_MAP[c.categoryId as keyof typeof CATEGORY_MAP];
    return {
      percentage: totalSpent === 0 ? 0 : (c.total / totalSpent) * 100,
      color: cat?.color ?? "#B8A9D4",
    };
  });

const toCategoryRows = (categories: readonly CategorySpendingItem[], locale: string) =>
  categories.map((c) => {
    const cat = CATEGORY_MAP[c.categoryId as keyof typeof CATEGORY_MAP];
    return {
      categoryId: c.categoryId,
      color: cat?.color ?? "#B8A9D4",
      name: cat ? getCategoryLabel(cat, locale) : c.categoryId,
      amount: formatMoney(c.total as CopAmount),
    };
  });

const MAX_VISIBLE_CATEGORIES = 5;
const OTHERS_COLOR = "#6B6B6B";
const LINE_CHART_WIDTH = 140;

const CarouselDots = ({ activeIndex }: { readonly activeIndex: number }) => {
  const primaryColor = useThemeColor("primary");

  return (
    <View className="flex-row items-center justify-center gap-2 pt-3">
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            width: activeIndex === i ? 8 : 6,
            height: activeIndex === i ? 8 : 6,
            borderRadius: 4,
            backgroundColor: activeIndex === i ? primaryColor : "#C4A882",
          }}
        />
      ))}
    </View>
  );
};

export const ChartSection = ({
  categorySpending,
  dailySpending,
  totalSpent,
  onPress,
}: ChartSectionProps) => {
  const { t, locale } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const secondaryColor = useThemeColor("secondary");

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

  const dailyTotal = dailySpending.reduce((sum, d) => sum + d.total, 0);
  const dayCount = dailySpending.length === 0 ? 1 : dailySpending.length;
  const avgPerDay = Math.round(dailyTotal / dayCount);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setSlideWidth(e.nativeEvent.layout.width);
  }, []);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (slideWidth === 0) return;
      const page = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
      setActiveIndex(page);
    },
    [slideWidth]
  );

  return (
    <Pressable onPress={onPress} className="rounded-chart bg-chart-bg p-4 dark:bg-chart-bg-dark">
      <View onLayout={handleLayout}>
        {slideWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            decelerationRate="fast"
          >
            {/* Slide 1: Donut Chart */}
            <View style={{ width: slideWidth }} className="flex-row gap-4">
              <DonutChart
                segments={segments}
                centerLabel={formatMoney(totalSpent as CopAmount)}
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
                    amount={formatMoney(remainingTotal as CopAmount)}
                  />
                )}
              </View>
            </View>

            {/* Slide 2: Line Chart */}
            <View style={{ width: slideWidth }} className="flex-row gap-4">
              <SpendingLineChart data={dailySpending} width={LINE_CHART_WIDTH} height={100} />
              <View className="flex-1 justify-center gap-1.5">
                <Text className="font-poppins-bold text-body text-primary dark:text-primary-dark">
                  {t("chart.dailySpending")}
                </Text>
                <Text
                  className="font-poppins-medium text-caption"
                  style={{ color: secondaryColor }}
                >
                  {t("chart.last30Days")}
                </Text>
                <View className="mt-2 gap-1">
                  <Text
                    className="font-poppins-medium text-caption"
                    style={{ color: secondaryColor }}
                  >
                    {t("chart.avgPerDay")}
                  </Text>
                  <Text className="font-poppins-bold text-body text-primary dark:text-primary-dark">
                    {formatMoney(avgPerDay as CopAmount)}
                  </Text>
                </View>
                <View className="mt-1 gap-1">
                  <Text
                    className="font-poppins-medium text-caption"
                    style={{ color: secondaryColor }}
                  >
                    {t("chart.thisMonthTotal")}
                  </Text>
                  <Text className="font-poppins-bold text-body text-primary dark:text-primary-dark">
                    {formatMoney(totalSpent as CopAmount)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
      <CarouselDots activeIndex={activeIndex} />
    </Pressable>
  );
};
