import { useMemo } from "react";
import Animated from "react-native-reanimated";
import { CATEGORIES, type CategoryId, CategoryPill } from "@/features/transactions";
import { FidyNumpad } from "@/shared/components";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useBlinkingCursor, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatInputDisplay, formatMoney } from "@/shared/lib";
import type { BudgetSuggestion } from "../../lib/derive";
import { styles } from "./CreateBudget.styles";

type CreateBudgetFormContentProps = {
  readonly autoSuggestions: readonly BudgetSuggestion[];
  readonly canMutate: boolean;
  readonly category: CategoryId | null;
  readonly digits: string;
  readonly existingCategoryIds: ReadonlySet<string>;
  readonly handleDelete: () => void;
  readonly handleKey: (key: string) => void;
  readonly handleSave: () => void;
  readonly isEdit: boolean;
  readonly isSaving: boolean;
  readonly setCategory: (category: CategoryId) => void;
};

function resolveLastMonthHintData(
  autoSuggestions: readonly BudgetSuggestion[],
  category: CategoryId | null,
  locale: string
) {
  if (!category) return null;
  const categoryOption = CATEGORIES.find((categoryItem) => categoryItem.id === category);
  if (!categoryOption) return null;
  const suggestion = autoSuggestions.find((item) => item.categoryId === category);
  if (!suggestion) return null;
  return {
    amount: formatMoney(suggestion.suggestedAmount),
    category: getCategoryLabel(categoryOption, locale),
  };
}

export function CreateBudgetFormContent({
  autoSuggestions,
  canMutate,
  category,
  digits,
  existingCategoryIds,
  handleDelete,
  handleKey,
  handleSave,
  isEdit,
  isSaving,
  setCategory,
}: CreateBudgetFormContentProps) {
  const { t, locale } = useTranslation();
  const { cursorStyle } = useBlinkingCursor();
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  const availableCategories = useMemo(
    () => CATEGORIES.filter((categoryOption) => !existingCategoryIds.has(categoryOption.id)),
    [existingCategoryIds]
  );
  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : "$";
  const lastMonthHintData = useMemo(
    () => resolveLastMonthHintData(autoSuggestions, category, locale),
    [autoSuggestions, category, locale]
  );
  const lastMonthHint = lastMonthHintData
    ? t("budgets.create.lastMonthHint", lastMonthHintData)
    : null;

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
            {availableCategories.map((categoryOption) => (
              <CategoryPill
                key={categoryOption.id}
                category={categoryOption}
                isSelected={category === categoryOption.id}
                onPress={() => setCategory(categoryOption.id)}
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
                backgroundColor: primaryColor,
                borderRadius: 1,
                height: 28,
                marginLeft: 2,
                width: 2,
              },
              cursorStyle,
            ]}
          />
        </View>
        {lastMonthHint ? (
          <Text style={[styles.hint, { color: secondaryColor }]}>{lastMonthHint}</Text>
        ) : null}
      </View>

      <Pressable
        style={[styles.saveButton, { backgroundColor: accentGreen, opacity: isSaving ? 0.5 : 1 }]}
        onPress={handleSave}
        disabled={isSaving || !canMutate}
      >
        <Text style={styles.saveButtonText}>{t("common.save")}</Text>
      </Pressable>

      {isEdit ? (
        <Pressable
          style={[styles.deleteButton, { borderColor: accentRed }]}
          onPress={handleDelete}
          disabled={isSaving || !canMutate}
        >
          <Text style={[styles.deleteButtonText, { color: accentRed }]}>{t("common.delete")}</Text>
        </Pressable>
      ) : null}

      <FidyNumpad onKeyPress={handleKey} />
    </ScrollView>
  );
}
