import { format, getDaysInMonth } from "date-fns";
import { CATEGORY_MAP } from "@/shared/categories";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { useColorScheme, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import type { CategorySpendingItem } from "./useHomeScreen";

type Translate = (key: string, params?: Record<string, unknown>) => string;

type HomeSpendingCardModelInput = {
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly locale: string;
  readonly monthlyBudget: number;
  readonly now: Date;
  readonly t: Translate;
};

type HomeCategoryBar = {
  readonly amountLabel: string;
  readonly categoryId: string;
  readonly color: string;
  readonly icon: string;
  readonly label: string;
  readonly percentage: number;
};

type HomeSpendingCardModel = {
  readonly amountLabel: string;
  readonly bars: readonly HomeCategoryBar[];
  readonly dateLabel: string;
  readonly guidance: string;
  readonly dailyPaceLabel: string;
  readonly averageLabel: string;
};

const MAX_CATEGORY_BARS = 7;
const MIN_BAR_PERCENTAGE = 34;
const MAX_BAR_PERCENTAGE = 100;

const clampBarPercentage = (percentage: number): number =>
  Math.max(MIN_BAR_PERCENTAGE, Math.min(MAX_BAR_PERCENTAGE, percentage));

const getDateFormat = (locale: string): string =>
  locale.startsWith("es") ? "EEEE, d 'de' MMMM" : "EEEE, MMMM d";

const deriveDailyAllowance = (spent: number, monthlyBudget: number, now: Date): number => {
  const remainingBudget = Math.max(monthlyBudget - spent, 0);
  const remainingDaysIncludingToday = Math.max(getDaysInMonth(now) - now.getDate() + 1, 1);
  return Math.floor(remainingBudget / remainingDaysIncludingToday);
};

const deriveAverageSpend = (spent: number, now: Date): number =>
  Math.round(spent / Math.max(now.getDate(), 1));

export function deriveHomeSpendingCardModel({
  balance,
  categorySpending,
  locale,
  monthlyBudget,
  now,
  t,
}: HomeSpendingCardModelInput): HomeSpendingCardModel {
  const dateFnsLocale = getDateFnsLocale(locale);
  const averageSpend = deriveAverageSpend(balance, now);
  const hasBudget = monthlyBudget > 0;
  const dailyPace = hasBudget ? deriveDailyAllowance(balance, monthlyBudget, now) : averageSpend;
  const visibleCategorySpending = categorySpending.filter(
    (item) => CATEGORY_MAP[item.categoryId] != null
  );
  const largestCategoryTotal = Math.max(...visibleCategorySpending.map((item) => item.total), 0);
  const bars = visibleCategorySpending
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_CATEGORY_BARS)
    .map((item) => {
      const category = CATEGORY_MAP[item.categoryId];
      return {
        amountLabel: formatMoney(item.total),
        categoryId: item.categoryId,
        color: category?.color ?? Colors.chart.other,
        icon: category?.icon ?? "✨",
        label: category ? getCategoryLabel(category, locale) : item.categoryId,
        percentage:
          largestCategoryTotal === 0
            ? MIN_BAR_PERCENTAGE
            : clampBarPercentage((item.total / largestCategoryTotal) * 100),
      };
    });

  return {
    amountLabel: formatMoney(balance),
    bars,
    dateLabel: format(
      now,
      getDateFormat(locale),
      dateFnsLocale ? { locale: dateFnsLocale } : undefined
    ),
    guidance: hasBudget
      ? t("dashboard.dailyPaceGuidance", { amount: formatMoney(dailyPace) })
      : t("dashboard.noBudgetGuidance", { amount: formatMoney(averageSpend) }),
    dailyPaceLabel: formatMoney(dailyPace),
    averageLabel: formatMoney(averageSpend),
  };
}

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
