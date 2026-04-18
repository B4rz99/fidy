import { memo, useCallback } from "react";
import { useOptionalUserId } from "@/features/auth";
import type { ViewStyle } from "@/shared/components/rn";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { AnalyticsPeriod } from "../lib/derive";
import { loadAnalyticsForUser, selectAnalyticsPeriod, useAnalyticsStore } from "../store";
import { CategoryBreakdownCard } from "./CategoryBreakdownCard";
import { IncomeExpenseCard } from "./IncomeExpenseCard";
import { PeriodDeltaCard } from "./PeriodDeltaCard";

const PERIODS: readonly AnalyticsPeriod[] = ["W", "M", "Q", "Y"];

type PeriodSelectorProps = {
  readonly activePeriod: AnalyticsPeriod;
  readonly onSelect: (period: AnalyticsPeriod) => void;
};

const PeriodSelector = memo(function PeriodSelector({
  activePeriod,
  onSelect,
}: PeriodSelectorProps) {
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={[styles.selectorContainer, { backgroundColor: peachLight }]}>
      {PERIODS.map((period) => {
        const isActive = period === activePeriod;
        return (
          <Pressable
            key={period}
            onPress={() => onSelect(period)}
            style={[styles.segment, isActive && { backgroundColor: accentGreen }]}
          >
            <Text
              style={[
                styles.segmentText,
                // White on accentGreen has sufficient contrast in both light and dark themes
                { color: isActive ? "#FFFFFF" : secondaryColor },
                isActive && styles.segmentTextActive,
              ]}
            >
              {period}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export function AnalyticsScreen() {
  const { t } = useTranslation();
  const period = useAnalyticsStore((s) => s.period);
  const incomeExpense = useAnalyticsStore((s) => s.incomeExpense);
  const categoryBreakdown = useAnalyticsStore((s) => s.categoryBreakdown);
  const periodDelta = useAnalyticsStore((s) => s.periodDelta);
  const isLoading = useAnalyticsStore((s) => s.isLoading);
  const userId = useOptionalUserId();

  // Load data on mount if boot-time load failed or hasn't completed
  useMountEffect(() => {
    if (userId && !incomeExpense && !isLoading) {
      loadAnalyticsForUser(getDb(userId), userId).catch(captureError);
    }
  });

  const handleSelectPeriod = useCallback(
    (nextPeriod: AnalyticsPeriod) => {
      if (!userId) return;
      void selectAnalyticsPeriod(getDb(userId), userId, nextPeriod).catch(captureError);
    },
    [userId]
  );

  const pageBg = useThemeColor("page");
  const secondaryColor = useThemeColor("secondary");
  const showEmpty = !incomeExpense && !isLoading;

  const scrollBg: ViewStyle = { backgroundColor: pageBg };

  return (
    <ScrollView
      style={[styles.scrollView, scrollBg]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <PeriodSelector activePeriod={period} onSelect={handleSelectPeriod} />

      {showEmpty ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: secondaryColor }]}>{t("analytics.noData")}</Text>
        </View>
      ) : (
        <>
          {incomeExpense != null && <IncomeExpenseCard data={incomeExpense} />}
          {categoryBreakdown.length > 0 && <CategoryBreakdownCard data={categoryBreakdown} />}
          {periodDelta != null && <PeriodDeltaCard period={period} data={periodDelta} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  selectorContainer: {
    height: 36,
    borderRadius: 20,
    borderCurve: "continuous",
    flexDirection: "row",
    padding: 3,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderCurve: "continuous",
  },
  segmentText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  segmentTextActive: {
    fontFamily: "Poppins_600SemiBold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    textAlign: "center",
  },
});
