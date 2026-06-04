import type { Dispatch, SetStateAction } from "react";
import { CATEGORY_MAP } from "@/shared/categories";
import { GlassSurface } from "@/shared/components";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import type { CategoryId } from "@/shared/types/branded";
import type { IncomeExpenseResult, PeriodShiftView } from "../lib/derive";
import { IncomeExpenseStrip } from "./IncomeExpenseStrip";

const CATEGORY_BAR_MAX_HEIGHT = 84;
const CATEGORY_BAR_MIN_HEIGHT = 24;

type PeriodShiftContentProps = {
  readonly incomeExpense: IncomeExpenseResult;
  readonly selectedCategoryId: CategoryId | null;
  readonly setSelectedCategoryId: Dispatch<SetStateAction<CategoryId | null>>;
  readonly shiftView: PeriodShiftView;
};

export function PeriodShiftContent({
  incomeExpense,
  selectedCategoryId,
  setSelectedCategoryId,
  shiftView,
}: PeriodShiftContentProps) {
  const { t, locale } = useTranslation();
  const secondaryColor = useThemeColor("secondary");
  const primaryColor = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const selectedBar =
    shiftView.categoryBars.find((item) => item.categoryId === selectedCategoryId) ??
    shiftView.categoryBars[0] ??
    null;
  const selectedCategory = selectedBar ? CATEGORY_MAP[selectedBar.categoryId] : null;
  const selectedCategoryLabel =
    selectedBar && selectedCategory ? getCategoryLabel(selectedCategory, locale) : null;
  const deltaCopyKey =
    shiftView.totalDeltaDirection === "unchanged"
      ? "analytics.periodDeltaSpentSame"
      : shiftView.totalDeltaDirection === "increased"
        ? "analytics.periodDeltaSpentMore"
        : "analytics.periodDeltaSpentLess";

  return (
    <>
      <GlassSurface padded={false} style={styles.heroCard}>
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
          selectedCategoryId={selectedBar?.categoryId ?? null}
          onSelect={setSelectedCategoryId}
        />

        {selectedBar && (
          <View style={[styles.selectedAmountPill, { backgroundColor: peachLight }]}>
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
      </GlassSurface>

      <CategoryChangesCard changes={shiftView.categoryChanges.slice(0, 4)} />
      <IncomeExpenseStrip incomeExpense={incomeExpense} />
    </>
  );
}

type CategoryBarRibbonProps = {
  readonly bars: PeriodShiftView["categoryBars"];
  readonly onSelect: (categoryId: CategoryId) => void;
  readonly selectedCategoryId: CategoryId | null;
};

function CategoryBarRibbon({ bars, onSelect, selectedCategoryId }: CategoryBarRibbonProps) {
  const { t, locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");

  return (
    <View style={styles.categoryRibbon}>
      {bars.map((item) => {
        const category = CATEGORY_MAP[item.categoryId];
        const color = category?.color ?? accentGreen;
        const isSelected = item.categoryId === selectedCategoryId;
        const amount = formatMoney(item.total);
        const categoryLabel = category ? getCategoryLabel(category, locale) : null;
        const height =
          CATEGORY_BAR_MIN_HEIGHT +
          (item.heightPercent / 100) * (CATEGORY_BAR_MAX_HEIGHT - CATEGORY_BAR_MIN_HEIGHT);

        return (
          <Pressable
            key={item.categoryId}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
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
            onPress={() => onSelect(item.categoryId)}
            style={styles.categoryBarTapTarget}
          >
            <View
              style={[
                styles.categoryBar,
                {
                  height,
                  backgroundColor: color,
                  opacity: isSelected ? 1 : 0.72,
                },
              ]}
            >
              <Text style={styles.categoryBarIcon}>{category?.icon ?? ""}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

type CategoryChangesCardProps = {
  readonly changes: PeriodShiftView["categoryChanges"];
};

function CategoryChangesCard({ changes }: CategoryChangesCardProps) {
  const { t, locale } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  return (
    <GlassSurface padded={false} style={styles.card}>
      <Text style={[styles.cardTitle, { color: primaryColor }]}>{t("analytics.whatChanged")}</Text>
      {changes.map((item) => {
        const category = CATEGORY_MAP[item.categoryId];
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
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
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
  categoryBarTapTarget: {
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
  selectedAmountPill: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  selectedAmountText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  card: {
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 7,
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
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
