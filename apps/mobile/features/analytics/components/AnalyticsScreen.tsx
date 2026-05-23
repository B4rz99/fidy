import { useCallback, useMemo, useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { TAB_BAR_CLEARANCE } from "@/shared/components";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { CategoryId } from "@/shared/types/branded";
import type { AnalyticsPeriod } from "../lib/derive";
import { derivePeriodShiftView } from "../lib/derive";
import { loadAnalyticsForUser, selectAnalyticsPeriod, useAnalyticsStore } from "../store";
import { PeriodSelector } from "./PeriodSelector";
import { PeriodShiftContent } from "./PeriodShiftContent";

const ANALYTICS_CARD_GAP = 8;
const ANALYTICS_CONTENT_PADDING = 14;

export function AnalyticsScreen() {
  const { t } = useTranslation();
  const period = useAnalyticsStore((s) => s.period);
  const incomeExpense = useAnalyticsStore((s) => s.incomeExpense);
  const categoryBreakdown = useAnalyticsStore((s) => s.categoryBreakdown);
  const periodDelta = useAnalyticsStore((s) => s.periodDelta);
  const isLoading = useAnalyticsStore((s) => s.isLoading);
  const userId = useOptionalUserId();
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryId | null>(null);

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

  const secondaryColor = useThemeColor("secondary");
  const shiftView = useMemo(
    () =>
      incomeExpense && periodDelta
        ? derivePeriodShiftView({ categoryBreakdown, periodDelta })
        : null,
    [categoryBreakdown, incomeExpense, periodDelta]
  );
  const showEmpty = !shiftView && !isLoading;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: ANALYTICS_CONTENT_PADDING + TAB_BAR_CLEARANCE },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <PeriodSelector activePeriod={period} onSelect={handleSelectPeriod} />

      {showEmpty ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: secondaryColor }]}>{t("analytics.noData")}</Text>
        </View>
      ) : (
        shiftView &&
        incomeExpense &&
        periodDelta && (
          <PeriodShiftContent
            incomeExpense={incomeExpense}
            selectedCategoryId={selectedCategoryId}
            setSelectedCategoryId={setSelectedCategoryId}
            shiftView={shiftView}
          />
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: ANALYTICS_CONTENT_PADDING,
    gap: ANALYTICS_CARD_GAP,
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
