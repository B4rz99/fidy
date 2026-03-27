import { memo, useCallback, useState } from "react";
import type { CategoryBreakdownItem } from "@/features/analytics/lib/derive";
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
import type { DashboardPeriod } from "../lib/derive";
import { CategoryRow } from "./CategoryRow";
import { DonutChart } from "./DonutChart";
import { SpendingLineChart } from "./SpendingLineChart";

const TOTAL_LABEL_KEYS: Record<DashboardPeriod, string> = {
  today: "chart.todayTotal",
  week: "chart.thisWeekTotal",
  month: "chart.thisMonthTotal",
};

type DailySpendingItem = {
  readonly date: string;
  readonly total: number;
};

type ChartSectionProps = {
  readonly period: DashboardPeriod;
  readonly categoryBreakdown: ReadonlyArray<CategoryBreakdownItem>;
  readonly dailySpending: readonly DailySpendingItem[];
  readonly totalSpent: CopAmount;
  readonly onChartPress: () => void;
};

const MAX_VISIBLE = 5;
const REMAINDER_COLOR = "#D4D4D4";

const toSegments = (categories: ReadonlyArray<CategoryBreakdownItem>) => {
  const top = categories.slice(0, MAX_VISIBLE);
  const otherPercent = categories.slice(MAX_VISIBLE).reduce((sum, c) => sum + c.percent, 0);
  const segments = top.map((c) => ({
    percentage: c.percent,
    color: CATEGORY_MAP[c.categoryId as keyof typeof CATEGORY_MAP]?.color ?? REMAINDER_COLOR,
  }));
  return otherPercent > 0
    ? [...segments, { percentage: otherPercent, color: REMAINDER_COLOR }]
    : segments;
};

const toCategoryRows = (
  categories: ReadonlyArray<CategoryBreakdownItem>,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const top = categories.slice(0, MAX_VISIBLE);
  const rest = categories.slice(MAX_VISIBLE);
  const rows = top.map((c) => {
    const cat = CATEGORY_MAP[c.categoryId as keyof typeof CATEGORY_MAP];
    return {
      categoryId: c.categoryId,
      color: cat?.color ?? REMAINDER_COLOR,
      name: cat ? getCategoryLabel(cat, locale) : c.categoryId,
      amount: formatMoney(c.total),
    };
  });
  if (rest.length === 0) return rows;
  const restTotal = rest.reduce((sum, c) => sum + c.total, 0);
  return [
    ...rows,
    {
      categoryId: "_remainder",
      color: REMAINDER_COLOR,
      name: t("dashboard.moreCategories", { count: rest.length }),
      amount: formatMoney(restTotal as CopAmount),
    },
  ];
};

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

export const ChartSection = memo(function ChartSection({
  period,
  categoryBreakdown,
  dailySpending,
  totalSpent,
  onChartPress,
}: ChartSectionProps) {
  const { t, locale } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const secondaryColor = useThemeColor("secondary");

  const segments = toSegments(categoryBreakdown);
  const rows = toCategoryRows(categoryBreakdown, locale, t);

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
    <Pressable
      onPress={onChartPress}
      className="rounded-chart bg-chart-bg p-4 dark:bg-chart-bg-dark"
    >
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
                  {period === "month" ? t("chart.last30Days") : t("chart.last7Days")}
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
                    {t(TOTAL_LABEL_KEYS[period])}
                  </Text>
                  <Text className="font-poppins-bold text-body text-primary dark:text-primary-dark">
                    {formatMoney(totalSpent)}
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
});
