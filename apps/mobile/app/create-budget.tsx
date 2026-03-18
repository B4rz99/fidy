import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useBudgetStore } from "@/features/budget";
import {
  CATEGORIES,
  type CategoryId,
  CategoryPill,
  digitsToCents,
  formatCents,
  formatDollars,
  handleNumpadPress,
  isValidCategoryId,
} from "@/features/transactions";
import { FidyNumpad } from "@/shared/components";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
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
  // digits = raw whole-dollar string (e.g. "18900" for $18,900 COP)
  const [digits, setDigits] = useState(
    existingBudget ? String(existingBudget.amountCents / 100) : ""
  );
  const digitsRef = useRef(digits);
  digitsRef.current = digits;

  // Blinking cursor
  const cursorOpacity = useSharedValue(1);
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: 530 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 530 })
      ),
      -1
    );
  }, [cursorOpacity]);
  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOpacity.value }));

  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-sync when the budget identity changes
  useEffect(() => {
    if (existingBudget) {
      setCategory(isValidCategoryId(existingBudget.categoryId) ? existingBudget.categoryId : "");
      setDigits(String(existingBudget.amountCents / 100));
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

  const displayAmount = digits.length > 0 ? formatDollars(digits) : "$";

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () =>
    guardedSave(async () => {
      const cents = digitsToCents(digits);
      if (cents <= 0) return;

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

  const handleKey = useCallback((key: string) => {
    setDigits(handleNumpadPress(digitsRef.current, key));
  }, []);

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
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={[styles.title, { color: primaryColor }]}>
        {isEdit ? t("budgets.edit.title") : t("budgets.create.title")}
      </Text>

      {!isEdit && (
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: secondaryColor }]}>
            {t("budgets.create.selectCategory")}
          </Text>
          <View style={styles.chipRow}>
            {availableCategories.map((c) => (
              <CategoryPill
                key={c.id}
                category={c}
                isSelected={category === c.id}
                onPress={() => setCategory(c.id)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.amountSection}>
        <Text style={[styles.inputLabel, { color: secondaryColor }]}>
          {t("budgets.create.enterAmount")}
        </Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amountDisplay, { color: primaryColor }]}>{displayAmount}</Text>
          <Animated.View
            style={[
              {
                width: 2,
                height: 28,
                marginLeft: 2,
                borderRadius: 1,
                backgroundColor: primaryColor,
              },
              cursorStyle,
            ]}
          />
        </View>
        {lastMonthHint && (
          <Text style={[styles.hint, { color: secondaryColor }]}>{lastMonthHint}</Text>
        )}
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
          <Text style={[styles.deleteButtonText, { color: accentRed }]}>{t("common.delete")}</Text>
        </Pressable>
      )}

      <FidyNumpad onKeyPress={handleKey} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  amountSection: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  amountDisplay: {
    fontFamily: "Poppins_700Bold",
    fontSize: 32,
  },
  hint: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    fontStyle: "italic",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
