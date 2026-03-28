import { useBudgetStore, useSuggestionSelection } from "@/features/budget";
import { CATEGORY_MAP } from "@/features/transactions";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import { useOnboardingStore } from "../store";

export function BudgetSetupStep() {
  const { t, locale } = useTranslation();
  const nextStep = useOnboardingStore((s) => s.nextStep);

  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);
  const acceptSuggestions = useBudgetStore((s) => s.acceptSuggestions);
  const loadAutoSuggestions = useBudgetStore((s) => s.loadAutoSuggestions);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const pageBg = useThemeColor("page");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  // Load suggestions on mount
  useMountEffect(() => {
    loadAutoSuggestions();
  });

  const { selectedIds, editedAmounts, handleToggle, handleAmountChange, buildBudgetMap } =
    useSuggestionSelection(autoSuggestions);

  const handleSave = () =>
    guardedRun(async () => {
      const budgets = buildBudgetMap();
      if (budgets.size > 0) {
        await acceptSuggestions(budgets);
      }
      nextStep();
    });

  const handleSkip = () => {
    nextStep();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("onboarding.budgetSetup.title")}
        </Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          {t("onboarding.budgetSetup.subtitle")}
        </Text>

        {autoSuggestions.length > 0 ? (
          <View style={styles.list}>
            {autoSuggestions.map((suggestion) => {
              const category = CATEGORY_MAP[suggestion.categoryId] ?? null;
              const CategoryIcon = category?.icon;
              const categoryLabel = category
                ? getCategoryLabel(category, locale)
                : suggestion.categoryId;
              const isSelected = selectedIds.has(suggestion.categoryId);

              return (
                <View key={suggestion.categoryId} style={[styles.row, { borderColor }]}>
                  <View style={styles.rowLeft}>
                    {category && CategoryIcon ? (
                      <CategoryIcon size={18} color={category.color} />
                    ) : null}
                    <View>
                      <Text style={[styles.categoryName, { color: primaryColor }]}>
                        {categoryLabel}
                      </Text>
                      <Text style={[styles.lastMonthLabel, { color: secondaryColor }]}>
                        {formatMoney(suggestion.suggestedAmount)}{" "}
                        {t("onboarding.budgetSetup.basedOnSpending").toLowerCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <TextInput
                      style={[
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
          <Text style={[styles.emptyText, { color: secondaryColor }]}>
            {t("onboarding.budgetSetup.noSuggestions")}
          </Text>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: accentGreen, opacity: isBusy ? 0.5 : 1 },
          ]}
          onPress={() => {
            void handleSave();
          }}
          disabled={isBusy}
        >
          <Text style={styles.primaryButtonText}>{t("onboarding.budgetSetup.saveBudgets")}</Text>
        </Pressable>
        <Pressable onPress={handleSkip}>
          <Text style={[styles.skipText, { color: secondaryColor }]}>
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
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
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
  lastMonthLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
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
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },
  actions: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 16,
  },
  primaryButton: {
    borderRadius: 14,
    borderCurve: "continuous",
    paddingVertical: 16,
    alignItems: "center",
    alignSelf: "stretch",
  },
  primaryButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  skipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
});
