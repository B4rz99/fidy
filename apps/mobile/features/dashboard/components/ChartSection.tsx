import { useCallback, useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "@/shared/components/rn";
import { CATEGORY_MAP, formatCentsRounded } from "@/features/transactions";
import { useThemeColor } from "@/shared/hooks";
import { CategoryRow } from "./CategoryRow";
import { DonutChart } from "./DonutChart";
import { SpendingLineChart } from "./SpendingLineChart";

type CategorySpendingItem = {
  readonly categoryId: string;
  readonly totalCents: number;
};

type DailySpendingItem = {
  readonly date: string;
  readonly totalCents: number;
};

type ChartSectionProps = {
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly dailySpending: readonly DailySpendingItem[];
  readonly totalSpentCents: number;
};

const toSegments = (categories: readonly CategorySpendingItem[], totalSpentCents: number) =>
  categories.map((c) => {
    const cat = CATEGORY_MAP[c.categoryId as keyof typeof CATEGORY_MAP];
    return {
      percentage: totalSpentCents === 0 ? 0 : (c.totalCents / totalSpentCents) * 100,
      color: cat?.color ?? "#B8A9D4",
    };
  });

const toCategoryRows = (categories: readonly CategorySpendingItem[]) =>
  categories.map((c) => {
    const cat = CATEGORY_MAP[c.categoryId as keyof typeof CATEGORY_MAP];
    return {
      categoryId: c.categoryId,
      color: cat?.color ?? "#B8A9D4",
      name: cat?.label.en ?? c.categoryId,
      amount: formatCentsRounded(c.totalCents),
    };
  });

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
  totalSpentCents,
}: ChartSectionProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const secondaryColor = useThemeColor("secondary");

  const segments = toSegments(categorySpending, totalSpentCents);
  const rows = toCategoryRows(categorySpending);

  const dailyTotal = dailySpending.reduce((sum, d) => sum + d.totalCents, 0);
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
    <View className="rounded-chart bg-chart-bg p-4 dark:bg-chart-bg-dark">
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
                centerLabel={formatCentsRounded(totalSpentCents)}
                centerSubLabel="spent"
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
                  Daily Spending
                </Text>
                <Text
                  className="font-poppins-medium text-caption"
                  style={{ color: secondaryColor }}
                >
                  Last 30 days
                </Text>
                <View className="mt-2 gap-1">
                  <Text
                    className="font-poppins-medium text-caption"
                    style={{ color: secondaryColor }}
                  >
                    Avg/day
                  </Text>
                  <Text className="font-poppins-bold text-body text-primary dark:text-primary-dark">
                    {formatCentsRounded(avgPerDay)}
                  </Text>
                </View>
                <View className="mt-1 gap-1">
                  <Text
                    className="font-poppins-medium text-caption"
                    style={{ color: secondaryColor }}
                  >
                    This month total
                  </Text>
                  <Text className="font-poppins-bold text-body text-primary dark:text-primary-dark">
                    {formatCentsRounded(totalSpentCents)}
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
};
