import { memo, useCallback, useState } from "react";
import type { CategoryBreakdownItem } from "@/features/analytics/lib/derive";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import type { DashboardPeriod } from "../lib/derive";
import { CategoryBarChart } from "./CategoryBarChart";
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
  readonly totalSpent: number;
  readonly onCategoryPress: () => void;
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
  onCategoryPress,
}: ChartSectionProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const secondaryColor = useThemeColor("secondary");

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
    <View className="gap-4">
      <View onLayout={handleLayout}>
        {slideWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            decelerationRate="fast"
          >
            {/* Slide 1: Category Bar Chart */}
            <View style={{ width: slideWidth }}>
              <CategoryBarChart categories={categoryBreakdown} onPress={onCategoryPress} />
            </View>

            {/* Slide 2: Line Chart */}
            <View
              style={{ width: slideWidth }}
              className="flex-row gap-4 rounded-chart bg-chart-bg p-4 dark:bg-chart-bg-dark"
            >
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
                    {formatMoney(totalSpent as CopAmount)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
      <CarouselDots activeIndex={activeIndex} />
    </View>
  );
});
