import { useMemo } from "react";
import { CategoryPill } from "@/features/transactions/ui.public";
import { CATEGORIES, type CategoryId } from "@/shared/categories";
import { Button, ChoiceTray, MoneyAmountDisplay, MoneyEntryScreen } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useBlinkingCursor, useThemeColor, useTranslation } from "@/shared/hooks";
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

export function CreateBudgetFormContent({
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
  const { t } = useTranslation();
  const { cursorStyle } = useBlinkingCursor();
  const primaryColor = useThemeColor("primary");

  const availableCategories = useMemo(
    () => CATEGORIES.filter((categoryOption) => !existingCategoryIds.has(categoryOption.id)),
    [existingCategoryIds]
  );

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
          {!isEdit && (
            <View style={styles.inputGroup}>
              <ChoiceTray>
                {availableCategories.map((categoryOption) => (
                  <CategoryPill
                    key={categoryOption.id}
                    category={categoryOption}
                    isSelected={category === categoryOption.id}
                    onPress={() => setCategory(categoryOption.id)}
                  />
                ))}
              </ChoiceTray>
            </View>
          )}
        </>
      }
      amountContent={
        <View style={styles.amountSection}>
          <MoneyAmountDisplay
            color={primaryColor}
            cursorStyle={cursorStyle}
            cursorVisible
            digits={digits}
            size="hero"
          />
        </View>
      }
      onKeyPress={handleKey}
    />
  );
}
