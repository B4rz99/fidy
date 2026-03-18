import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBudgetStore } from "@/features/budget";
import {
  CATEGORIES,
  type CategoryId,
  formatCents,
  isValidCategoryId,
} from "@/features/transactions";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";

export default function CreateBudgetScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { budgetId } = useLocalSearchParams<{ budgetId?: string }>();

  const budgets = useBudgetStore((s) => s.budgets);
  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);
  const createBudget = useBudgetStore((s) => s.createBudget);
  const updateBudget = useBudgetStore((s) => s.updateBudget);
  const deleteBudget = useBudgetStore((s) => s.deleteBudget);

  const existingBudget = budgetId ? budgets.find((b) => b.id === budgetId) : undefined;
  const isEdit = !!existingBudget;

  const [category, setCategory] = useState<CategoryId>(
    existingBudget?.categoryId && isValidCategoryId(existingBudget.categoryId)
      ? existingBudget.categoryId
      : ""
  );
  const [amount, setAmount] = useState(
    existingBudget ? String(existingBudget.amountCents / 100) : ""
  );

  const amountRef = useRef<TextInput>(null);

  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const pageBg = useThemeColor("page");

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-sync when the budget identity changes
  useEffect(() => {
    if (existingBudget) {
      setCategory(isValidCategoryId(existingBudget.categoryId) ? existingBudget.categoryId : "");
      setAmount(String(existingBudget.amountCents / 100));
    }
  }, [existingBudget?.id]);

  const existingCategoryIds = useMemo(
    () => new Set(budgets.filter((b) => b.id !== budgetId).map((b) => b.categoryId)),
    [budgets, budgetId]
  );

  const availableCategories = useMemo(
    () => CATEGORIES.filter((c) => !existingCategoryIds.has(c.id)),
    [existingCategoryIds]
  );

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () =>
    guardedSave(async () => {
      const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (Number.isNaN(cents) || cents <= 0) return;

      if (isEdit && existingBudget) {
        await updateBudget(existingBudget.id, cents);
        router.back();
      } else {
        if (!category) return;
        const success = await createBudget(category, cents);
        if (success) router.back();
      }
    });

  const handleDelete = () =>
    guardedSave(async () => {
      if (!existingBudget) return;
      await deleteBudget(existingBudget.id);
      router.back();
    });

  const handleCategoryPress = (id: CategoryId) => {
    Keyboard.dismiss();
    setCategory(id);
  };

  // Hint: last month spending for selected category
  const lastMonthHint = useMemo(() => {
    if (!category) return null;
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat) return null;
    const catLabel = getCategoryLabel(cat, locale);
    const suggestion = autoSuggestions.find((s) => s.categoryId === category);
    if (!suggestion) return null;
    return t("budgets.create.lastMonthHint", {
      amount: formatCents(suggestion.suggestedAmountCents),
      category: catLabel,
    });
  }, [category, locale, t, autoSuggestions]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: cardBg }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: primaryColor }]}>
          {isEdit ? t("budgets.edit.title") : t("budgets.create.title")}
        </Text>

        <View style={styles.formGrid}>
          {!isEdit && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: secondaryColor }]}>
                {t("budgets.create.selectCategory")}
              </Text>
              <View style={styles.chipRow}>
                {availableCategories.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: category === c.id ? accentGreen : pageBg,
                        borderColor,
                      },
                    ]}
                    onPress={() => handleCategoryPress(c.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: category === c.id ? "#FFFFFF" : primaryColor },
                      ]}
                    >
                      {getCategoryLabel(c, locale)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("budgets.create.enterAmount")}
            </Text>
            <TextInput
              ref={amountRef}
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={secondaryColor}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            {lastMonthHint && (
              <Text style={[styles.hint, { color: secondaryColor }]}>{lastMonthHint}</Text>
            )}
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: accentGreen, opacity: isSaving ? 0.5 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>{t("common.save")}</Text>
        </Pressable>

        {isEdit && (
          <Pressable
            style={[styles.deleteButton, { borderColor: accentRed }]}
            onPress={handleDelete}
            disabled={isSaving}
          >
            <Text style={[styles.deleteButtonText, { color: accentRed }]}>
              {t("common.delete")}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  formGrid: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  input: {
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    minHeight: 44,
  },
  hint: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  saveButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  saveButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  deleteButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  deleteButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
});
