import { PickerDialog, PickerOptionRow } from "@/shared/components";
import { Text } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import type { Category } from "../lib/categories";
import { CATEGORIES } from "../lib/categories";

export function TransactionCategoryPickerDialog(props: {
  readonly categoryId: Category["id"] | null;
  readonly locale: string;
  readonly onClose: () => void;
  readonly onSelect: (categoryId: Category["id"]) => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();

  return (
    <PickerDialog
      visible={props.visible}
      testID="category-picker.backdrop"
      title={t("common.category")}
      onClose={props.onClose}
    >
      {CATEGORIES.map((category) => {
        const isSelected = category.id === props.categoryId;
        return (
          <PickerOptionRow
            key={category.id}
            selected={isSelected}
            onPress={() => props.onSelect(category.id)}
            leading={<Text style={{ fontSize: 20 }}>{category.icon}</Text>}
            title={getCategoryLabel(category, props.locale)}
          />
        );
      })}
    </PickerDialog>
  );
}
