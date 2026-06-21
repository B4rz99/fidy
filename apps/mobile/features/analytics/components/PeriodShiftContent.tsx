import type { Dispatch, SetStateAction } from "react";
import type { GestureResponderEvent } from "react-native";
import { format } from "date-fns";
import { getCategoryBarBackgroundColor, type Category } from "@/shared/categories";
import { Card, CategoryIconButton, RaisedSurface } from "@/shared/components";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, formatSignedMoney } from "@/shared/lib";
import type { CategoryId } from "@/shared/types/branded";
import type { CategoryExpenseItem, IncomeExpenseResult, PeriodShiftView } from "../lib/derive";
import { IncomeExpenseStrip } from "./IncomeExpenseStrip";

const CATEGORY_BAR_MAX_HEIGHT = 84;
const CATEGORY_BAR_MIN_HEIGHT = 24;

type PeriodShiftContentProps = {
  readonly incomeExpense: IncomeExpenseResult;
  readonly categoryExpenses: readonly CategoryExpenseItem[];
  readonly selectedCategoryId: CategoryId | null;
  readonly setSelectedCategoryId: Dispatch<SetStateAction<CategoryId | null>>;
  readonly shiftView: PeriodShiftView;
  readonly categoryById: ReadonlyMap<CategoryId, Category>;
};

export function PeriodShiftContent({
  categoryExpenses,
  categoryById,
  incomeExpense,
  selectedCategoryId,
  setSelectedCategoryId,
  shiftView,
}: PeriodShiftContentProps) {
  const { t, locale } = useTranslation();
  const secondaryColor = useThemeColor("secondary");
  const primaryColor = useThemeColor("primary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const selectedBar = selectedCategoryId
    ? (shiftView.categoryBars.find((item) => item.categoryId === selectedCategoryId) ?? null)
    : null;
  const selectedCategory = selectedBar ? categoryById.get(selectedBar.categoryId) : null;
  const selectedCategoryLabel =
    selectedBar && selectedCategory ? getCategoryLabel(selectedCategory, locale) : null;
  const selectedCategoryExpenses = selectedBar
    ? categoryExpenses.filter((item) => item.categoryId === selectedBar.categoryId)
    : [];
  const deltaCopyKey =
    shiftView.totalDeltaDirection === "unchanged"
      ? "analytics.periodDeltaSpentSame"
      : shiftView.totalDeltaDirection === "increased"
        ? "analytics.periodDeltaSpentMore"
        : "analytics.periodDeltaSpentLess";

  return (
    <>
      <Card
        padded={false}
        contentStyle={styles.heroCard}
        onPress={() => setSelectedCategoryId(null)}
      >
        <Text style={[styles.eyebrow, { color: secondaryColor }]}>
          {t("analytics.vsPreviousPeriodLabel")}
        </Text>
        <Text
          style={[
            styles.deltaFigure,
            {
              color:
                shiftView.totalDeltaDirection === "increased"
                  ? accentRed
                  : shiftView.totalDeltaDirection === "decreased"
                    ? accentGreen
                    : secondaryColor,
            },
          ]}
        >
          {shiftView.totalDeltaPercentText}
        </Text>
        <Text style={[styles.heroCopy, { color: secondaryColor }]}>
          {t(deltaCopyKey, { amount: shiftView.totalDeltaAbsoluteAmountText })}
        </Text>

        <CategoryBarRibbon
          bars={shiftView.categoryBars}
          categoryById={categoryById}
          selectedCategoryId={selectedBar?.categoryId ?? null}
          onSelect={(categoryId) => setSelectedCategoryId(categoryId)}
        />

        {selectedBar && (
          <View style={styles.selectedAmount}>
            <Text style={[styles.selectedAmountText, { color: primaryColor }]}>
              {selectedCategoryLabel
                ? t("analytics.selectedCategoryAmount", {
                    category: selectedCategoryLabel,
                    amount: formatMoney(selectedBar.total),
                  })
                : formatMoney(selectedBar.total)}
            </Text>
          </View>
        )}
      </Card>

      {selectedBar && selectedCategoryLabel && selectedCategoryExpenses.length > 0 ? (
        <SelectedCategoryExpensesCard
          expenses={selectedCategoryExpenses}
          title={t("analytics.selectedCategoryExpenses", { category: selectedCategoryLabel })}
        />
      ) : null}

      <CategoryChangesCard
        categoryById={categoryById}
        changes={shiftView.categoryChanges.slice(0, 4)}
      />
      <IncomeExpenseStrip incomeExpense={incomeExpense} />
    </>
  );
}

type SelectedCategoryExpensesCardProps = {
  readonly expenses: readonly CategoryExpenseItem[];
  readonly title: string;
};

function SelectedCategoryExpensesCard({ expenses, title }: SelectedCategoryExpensesCardProps) {
  const { t, locale } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentRed = useThemeColor("accentRed");
  const surfaceMuted = useThemeColor("surfaceMuted");
  const dateLocale = getDateFnsLocale(locale);

  return (
    <Card padded={false} contentStyle={styles.selectedExpensesCard}>
      <Text style={[styles.cardTitle, { color: primaryColor }]}>{title}</Text>
      {expenses.map((item) => (
        <RaisedSurface key={item.id} style={styles.expenseRow}>
          <View style={styles.expenseTextGroup}>
            <Text style={[styles.expenseDescription, { color: primaryColor }]} numberOfLines={1}>
              {item.description ?? t("analytics.unnamedExpense")}
            </Text>
            <Text style={[styles.expenseDate, { color: secondaryColor }]}>
              {format(item.date, "d MMM", { locale: dateLocale })}
            </Text>
          </View>
          <View style={[styles.expenseAmountBadge, { backgroundColor: surfaceMuted }]}>
            <Text style={[styles.expenseAmount, { color: accentRed }]}>
              {formatSignedMoney(item.amount, "expense")}
            </Text>
          </View>
        </RaisedSurface>
      ))}
    </Card>
  );
}

type CategoryBarRibbonProps = {
  readonly bars: PeriodShiftView["categoryBars"];
  readonly categoryById: ReadonlyMap<CategoryId, Category>;
  readonly onSelect: (categoryId: CategoryId) => void;
  readonly selectedCategoryId: CategoryId | null;
};

function CategoryBarRibbon({
  bars,
  categoryById,
  onSelect,
  selectedCategoryId,
}: CategoryBarRibbonProps) {
  const { t, locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");

  return (
    <View style={styles.categoryRibbon}>
      {bars.map((item) => {
        const category = categoryById.get(item.categoryId);
        const color = getCategoryBarBackgroundColor(
          item.categoryId,
          category?.color ?? accentGreen
        );
        const isSelected = item.categoryId === selectedCategoryId;
        const amount = formatMoney(item.total);
        const categoryLabel = category ? getCategoryLabel(category, locale) : null;
        const height =
          CATEGORY_BAR_MIN_HEIGHT +
          (item.heightPercent / 100) * (CATEGORY_BAR_MAX_HEIGHT - CATEGORY_BAR_MIN_HEIGHT);
        const handlePress = (event: GestureResponderEvent) => {
          event.stopPropagation();
          onSelect(item.categoryId);
        };

        return (
          <CategoryIconButton
            key={item.categoryId}
            accessibilityLabel={
              categoryLabel
                ? t(
                    isSelected ? "analytics.categoryBarSelectedA11y" : "analytics.categoryBarA11y",
                    {
                      category: categoryLabel,
                      amount,
                    }
                  )
                : amount
            }
            backgroundColor={color}
            category={category ?? null}
            dimmed={!isSelected}
            haptics={false}
            onPress={handlePress}
            selected={isSelected}
            style={{ height }}
            variant="bar"
          />
        );
      })}
    </View>
  );
}

type CategoryChangesCardProps = {
  readonly categoryById: ReadonlyMap<CategoryId, Category>;
  readonly changes: PeriodShiftView["categoryChanges"];
};

function CategoryChangesCard({ categoryById, changes }: CategoryChangesCardProps) {
  const { t, locale } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  return (
    <Card padded={false} contentStyle={styles.card}>
      <Text style={[styles.cardTitle, { color: primaryColor }]}>{t("analytics.whatChanged")}</Text>
      {changes.map((item) => {
        const category = categoryById.get(item.categoryId);
        return (
          <View key={item.categoryId} style={styles.deltaRow}>
            <Text style={[styles.deltaLabel, { color: secondaryColor }]} numberOfLines={1}>
              {category?.icon}{" "}
              {category ? getCategoryLabel(category, locale) : String(item.categoryId)}
            </Text>
            <Text
              style={[
                styles.deltaValue,
                {
                  color:
                    item.trend === "increased"
                      ? accentRed
                      : item.trend === "decreased"
                        ? accentGreen
                        : secondaryColor,
                },
              ]}
            >
              {item.deltaText}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 14,
    gap: 8,
  },
  eyebrow: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
  },
  deltaFigure: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 48,
    lineHeight: 52,
  },
  heroCopy: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  categoryRibbon: {
    height: CATEGORY_BAR_MAX_HEIGHT + 6,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 7,
    paddingTop: 6,
  },
  selectedAmount: {
    alignSelf: "flex-start",
  },
  selectedAmountText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  card: {
    padding: 14,
    gap: 7,
  },
  selectedExpensesCard: {
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  expenseRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  expenseTextGroup: {
    flex: 1,
    gap: 2,
  },
  expenseDescription: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  expenseDate: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    textTransform: "capitalize",
  },
  expenseAmountBadge: {
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  expenseAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    textAlign: "right",
  },
  deltaRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  deltaLabel: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  deltaValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    textAlign: "right",
  },
});
