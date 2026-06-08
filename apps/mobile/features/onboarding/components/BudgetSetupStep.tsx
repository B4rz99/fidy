import { useOptionalUserId } from "@/features/auth/public";
import { useSuggestionSelection } from "@/features/budget/hooks.public";
import {
  acceptBudgetSuggestions,
  loadBudgetAutoSuggestions,
  useBudgetStore,
} from "@/features/budget/public";
import { BudgetSuggestionRow } from "@/features/budget/ui.public";
import { useEmailCaptureStore } from "@/features/email-capture/public";
import { Button, EmptyState } from "@/shared/components";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { logOnboardingEvent, trackOnboardingEvent } from "../lib/telemetry";
import { useOnboardingStore } from "../store";
import { shouldRefreshBudgetSuggestions } from "./BudgetSetupStep.helpers";

export function BudgetSetupStep() {
  const { t } = useTranslation();
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);

  const primaryColor = useThemeColor("primary");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  useMountEffect(() => {
    if (!userId || !db) return;
    const loadSuggestions = (trackLoaded: boolean) => {
      if (trackLoaded) {
        logOnboardingEvent("budget_suggestions_load_start");
      }
      loadBudgetAutoSuggestions(db, userId);
      if (!trackLoaded) return;
      trackOnboardingEvent("budget_suggestions_loaded", {
        suggestionCount: useBudgetStore.getState().autoSuggestions.length,
      });
    };
    loadSuggestions(true);

    return useEmailCaptureStore.subscribe((state, previousState) => {
      if (!shouldRefreshBudgetSuggestions(previousState, state)) return;
      loadSuggestions(false);
    });
  });

  const { selectedIds, editedAmounts, handleToggle, handleAmountChange, buildBudgetMap } =
    useSuggestionSelection(autoSuggestions);

  const handleSave = () =>
    guardedRun(async () => {
      const budgets = buildBudgetMap();
      if (budgets.size > 0) {
        if (!userId || !db) return;
        const success = await acceptBudgetSuggestions(db, userId, budgets);
        trackOnboardingEvent("budget_suggestions_accept_result", {
          budgetCount: budgets.size,
          success,
        });
        if (!success) return;
      }
      nextStep();
    });

  const handleSkip = () => {
    trackOnboardingEvent("budget_suggestions_skipped", {
      suggestionCount: autoSuggestions.length,
    });
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("onboarding.budgetSetup.title")}
        </Text>
        <Text className="text-center font-poppins-medium text-sm text-text-secondary dark:text-text-secondary-dark">
          {t("onboarding.budgetSetup.subtitle")}
        </Text>

        {autoSuggestions.length > 0 ? (
          <View style={styles.list}>
            {autoSuggestions.map((suggestion) => {
              const isSelected = selectedIds.has(suggestion.categoryId);

              return (
                <BudgetSuggestionRow
                  key={suggestion.categoryId}
                  categoryId={suggestion.categoryId}
                  value={editedAmounts[suggestion.categoryId] ?? ""}
                  selected={isSelected}
                  onAmountChange={handleAmountChange}
                  onToggle={handleToggle}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            title={t("onboarding.budgetSetup.noSuggestions")}
            className="min-h-24 flex-none px-4 py-6"
          />
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          label={t("onboarding.budgetSetup.saveBudgets")}
          onPress={() => {
            void handleSave();
          }}
          disabled={isBusy || ((userId == null || db == null) && selectedIds.size > 0)}
          loading={isBusy}
        />
        <Pressable
          accessible
          accessibilityLabel={t("onboarding.budgetSetup.skipForNow")}
          accessibilityRole="button"
          onPress={handleSkip}
        >
          <Text className="font-poppins-medium text-sm text-text-secondary dark:text-text-secondary-dark">
            {t("onboarding.budgetSetup.skipForNow")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
    gap: 12,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  list: {
    gap: 0,
    marginTop: 8,
  },
  actions: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 16,
  },
});
