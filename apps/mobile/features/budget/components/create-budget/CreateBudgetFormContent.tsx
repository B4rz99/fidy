import { useMemo } from "react";
import { useAvailableCategories } from "@/features/categories/hooks.public";
import { CategoryStrip } from "@/features/transactions/ui.public";
import type { CategoryId } from "@/shared/categories";
import { Button, MoneyAmountDisplay, MoneyEntryScreen } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
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
  readonly headerTitle: string;
  readonly isEdit: boolean;
  readonly isSaving: boolean;
  readonly setCategory: (category: CategoryId) => void;
};

export function CreateBudgetFormContent({
  autoSuggestions,
  canMutate,
  category,
  digits,
  existingCategoryIds,
  handleDelete,
  handleKey,
  handleSave,
  headerTitle,
  isEdit,
  isSaving,
  setCategory,
}: CreateBudgetFormContentProps) {
  const { locale, t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const categories = useAvailableCategories();

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (categoryOption) =>
          category === categoryOption.id || !existingCategoryIds.has(categoryOption.id)
      ),
    [categories, category, existingCategoryIds]
  );
  const selectedSuggestion = autoSuggestions.find(
    (suggestion) => suggestion.categoryId === category
  );
  const selectedCategory = categories.find((categoryOption) => categoryOption.id === category);

  return (
    <MoneyEntryScreen
      actionContent={
        <>
          <Button
            label={t("common.save")}
            onPress={handleSave}
            disabled={isSaving || !canMutate}
            loading={isSaving}
          />

          {isEdit ? (
            <Button
              label={t("common.delete")}
              variant="danger"
              onPress={handleDelete}
              disabled={isSaving || !canMutate}
            />
          ) : null}
        </>
      }
      detailContent={
        <>
          <View style={styles.categoryStrip}>
            <CategoryStrip
              categories={availableCategories}
              categoryId={category}
              onCategoryChange={setCategory}
            />
          </View>
        </>
      }
      amountContent={
        <View style={styles.amountPressTarget}>
          <MoneyAmountDisplay color={primaryColor} digits={digits} textStyle={styles.amountText} />
          {selectedSuggestion && selectedCategory ? (
            <Text style={[styles.suggestionHint, { color: secondaryColor }]}>
              {t("budgets.create.lastMonthHint", {
                amount: formatMoney(selectedSuggestion.suggestedAmount),
                category: getCategoryLabel(selectedCategory, locale),
              })}
            </Text>
          ) : null}
        </View>
      }
      headerTitle={headerTitle}
      onKeyPress={handleKey}
    />
  );
}
