import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useColorScheme, useTranslation } from "@/shared/hooks";
import type { CategorySpendingItem } from "./useHomeScreen";
import { deriveHomeSpendingCardModel } from "./HomeSpendingCard.model";

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const model = deriveHomeSpendingCardModel({
    balance,
    categorySpending,
    locale,
    monthlyBudget,
    now: new Date(),
    t,
  });

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={t("dashboard.spendingSummary")}
      onPress={onPress}
      className="overflow-hidden rounded-chart"
      style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}
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
        <View
          className="h-28 flex-row items-end gap-2 pt-4"
          accessibilityLabel={t("dashboard.categoryBars")}
        >
          {model.bars.map((bar) => (
            <View key={bar.categoryId} className="flex-1 items-center gap-1">
              <View
                className="w-full items-center justify-end rounded-icon"
                style={{
                  height: `${bar.percentage}%`,
                  minHeight: 24,
                  backgroundColor: bar.color,
                  borderTopLeftRadius: 999,
                  borderTopRightRadius: 999,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                }}
                accessible
                accessibilityLabel={`${bar.label}, ${bar.amountLabel}`}
              >
                <Text className="pb-1 text-caption">{bar.icon}</Text>
              </View>
            </View>
          ))}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
  },
  cardLight: {
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    borderColor: "rgba(26, 26, 26, 0.12)",
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: "rgba(28, 28, 30, 0.86)",
    borderColor: "rgba(240, 240, 240, 0.12)",
    borderWidth: 1,
  },
});
