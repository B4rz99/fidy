import { useOptionalUserId } from "@/features/auth/public";
import { useSuggestionSelection } from "@/features/budget/hooks.public";
import {
  acceptBudgetSuggestions,
  loadBudgetAutoSuggestions,
  useBudgetStore,
} from "@/features/budget/public";
import { useEmailCaptureStore } from "@/features/email-capture/public";
import { CATEGORY_MAP } from "@/shared/categories";
import { Button, EmptyState, FormTextField } from "@/shared/components";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { logOnboardingEvent, trackOnboardingEvent } from "../lib/telemetry";
import { useOnboardingStore } from "../store";
import { shouldRefreshBudgetSuggestions } from "./BudgetSetupStep.helpers";

export function BudgetSetupStep() {
  const { t, locale } = useTranslation();
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const pageBg = useThemeColor("page");

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
              const category = CATEGORY_MAP[suggestion.categoryId] ?? null;
              const categoryLabel = category
                ? getCategoryLabel(category, locale)
                : suggestion.categoryId;
              const isSelected = selectedIds.has(suggestion.categoryId);

              return (
                <View key={suggestion.categoryId} style={[styles.row, { borderColor }]}>
                  <View style={styles.rowLeft}>
                    {category ? (
                      <Text style={{ color: category.color }}>{category.icon}</Text>
                    ) : null}
                    <View>
                      <Text style={[styles.categoryName, { color: primaryColor }]}>
                        {categoryLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <FormTextField
                      label={categoryLabel}
                      labelStyle={{ display: "none" }}
                      style={{ gap: 0 }}
                      inputStyle={[
                        styles.amountInput,
                        {
                          backgroundColor: pageBg,
                          color: isSelected ? primaryColor : secondaryColor,
                          borderColor,
                          opacity: isSelected ? 1 : 0.4,
                        },
                      ]}
                      value={editedAmounts[suggestion.categoryId] ?? ""}
                      onChangeText={(v) => handleAmountChange(suggestion.categoryId, v)}
                      keyboardType="number-pad"
                      editable={isSelected}
                      selectTextOnFocus
                    />
                    <Switch
                      value={isSelected}
                      onValueChange={() => handleToggle(suggestion.categoryId)}
                      trackColor={{ true: accentGreen }}
                    />
                  </View>
                </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  amountInput: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 64,
    textAlign: "right",
    minHeight: 36,
  },
  actions: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 16,
  },
});
