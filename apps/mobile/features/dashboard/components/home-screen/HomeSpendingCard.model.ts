import { format, getDaysInMonth } from "date-fns";
import type { Category } from "@/shared/categories";
import { Colors } from "@/shared/constants/theme";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import type { CategorySpendingItem } from "./useHomeScreen";

type Translate = (key: string, params?: Record<string, unknown>) => string;

type HomeSpendingCardModelInput = {
  readonly balance: number;
  readonly categories: readonly Category[];
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
  categories,
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
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const visibleCategorySpending = categorySpending.filter((item) =>
    categoryById.has(item.categoryId)
  );
  const largestCategoryTotal = Math.max(...visibleCategorySpending.map((item) => item.total), 0);
  const bars = visibleCategorySpending
    .slice()
    .sort((a, b) => b.total - a.total)
    .map((item) => {
      const category = categoryById.get(item.categoryId);
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
