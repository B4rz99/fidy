import { Surface, MetricCard } from "@/shared/components";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import type { CategorySpendingItem } from "./useHomeScreen";
import { deriveHomeSpendingCardModel } from "./HomeSpendingCard.model";

const CATEGORY_BAR_MAX_HEIGHT = 84;
const CATEGORY_BAR_MIN_HEIGHT = 24;

type HomeSpendingCardProps = {
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly monthlyBudget: number;
  readonly onPress?: () => void;
};

export function HomeSpendingCard({
  balance,
  categorySpending,
  monthlyBudget,
  onPress,
}: HomeSpendingCardProps) {
  const { t, locale } = useTranslation();
  const model = deriveHomeSpendingCardModel({
    balance,
    categorySpending,
    locale,
    monthlyBudget,
    now: new Date(),
    t,
  });

  return (
    <MetricCard
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={t("dashboard.spendingSummary")}
      onPress={onPress}
      padded={false}
      contentClassName="p-6"
    >
      <View className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="font-poppins-semibold text-label uppercase tracking-widest text-secondary dark:text-secondary-dark">
            {t("dashboard.monthlySpend")}
          </Text>
          <Text className="text-right font-poppins-semibold text-caption uppercase tracking-widest text-tertiary dark:text-tertiary-dark">
            {model.dateLabel.toLocaleUpperCase(locale)}
          </Text>
        </View>
        <View className="gap-2">
          <Text className="font-poppins-bold text-balance text-primary dark:text-primary-dark">
            {model.amountLabel}
          </Text>
          <Text className="font-poppins-medium text-body text-secondary dark:text-secondary-dark">
            {model.guidance}
          </Text>
        </View>
        <View style={styles.categoryRibbon} accessibilityLabel={t("dashboard.categoryBars")}>
          {model.bars.map((bar) => {
            const height =
              CATEGORY_BAR_MIN_HEIGHT +
              (bar.percentage / 100) * (CATEGORY_BAR_MAX_HEIGHT - CATEGORY_BAR_MIN_HEIGHT);

            return (
              <View
                key={bar.categoryId}
                style={styles.categoryBarContainer}
                accessible
                accessibilityLabel={`${bar.label}, ${bar.amountLabel}`}
              >
                <Surface
                  backgroundColor={bar.color}
                  radius={8}
                  padded={false}
                  style={[styles.categoryBar, { height }]}
                >
                  <Text style={styles.categoryBarIcon}>{bar.icon}</Text>
                </Surface>
              </View>
            );
          })}
        </View>
        <View className="flex-row gap-4">
          <View className="flex-1 flex-row items-baseline gap-2">
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark">
              {t("dashboard.dailyPace")}
            </Text>
            <Text className="font-poppins-semibold text-body text-tertiary dark:text-tertiary-dark">
              {model.dailyPaceLabel}
            </Text>
          </View>
          <View className="flex-1 flex-row items-baseline gap-2">
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark">
              {t("dashboard.average")}
            </Text>
            <Text className="font-poppins-semibold text-body text-tertiary dark:text-tertiary-dark">
              {model.averageLabel}
            </Text>
          </View>
        </View>
      </View>
    </MetricCard>
  );
}

const styles = StyleSheet.create({
  categoryRibbon: {
    height: CATEGORY_BAR_MAX_HEIGHT + 6,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 7,
    paddingTop: 6,
  },
  categoryBarContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  categoryBar: {
    width: "100%",
    maxWidth: 44,
    minHeight: CATEGORY_BAR_MIN_HEIGHT,
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: 8,
    borderCurve: "continuous",
    paddingTop: 7,
  },
  categoryBarIcon: {
    fontSize: 16,
  },
});
