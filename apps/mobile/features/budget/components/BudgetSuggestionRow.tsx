import type { CategoryId } from "@/shared/categories";
import { CATEGORY_MAP } from "@/shared/categories";
import { FormTextField, ListRowSurface } from "@/shared/components";
import { StyleSheet, Switch, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";

type BudgetSuggestionRowProps = {
  readonly categoryId: CategoryId;
  readonly value: string;
  readonly selected: boolean;
  readonly onAmountChange: (categoryId: CategoryId, value: string) => void;
  readonly onToggle: (categoryId: CategoryId) => void;
};

export function BudgetSuggestionRow({
  categoryId,
  value,
  selected,
  onAmountChange,
  onToggle,
}: BudgetSuggestionRowProps) {
  const { locale, t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const category = CATEGORY_MAP[categoryId] ?? null;
  const categoryLabel = category ? getCategoryLabel(category, locale) : t("common.unknown");

  return (
    <ListRowSurface variant="grouped" divider contentStyle={styles.row}>
      <View style={styles.rowLeft}>
        {category ? <Text style={{ color: category.color }}>{category.icon}</Text> : null}
        <Text style={[styles.categoryName, { color: primaryColor }]}>{categoryLabel}</Text>
      </View>
      <View style={styles.rowRight}>
        <FormTextField
          label={categoryLabel}
          labelStyle={styles.hiddenLabel}
          style={styles.amountField}
          inputStyle={[
            styles.amountInput,
            {
              color: selected ? primaryColor : secondaryColor,
              opacity: selected ? 1 : 0.4,
            },
          ]}
          value={value}
          onChangeText={(nextValue) => onAmountChange(categoryId, nextValue)}
          keyboardType="number-pad"
          editable={selected}
          selectTextOnFocus
        />
        <Switch
          value={selected}
          onValueChange={() => onToggle(categoryId)}
          trackColor={{ true: accentGreen }}
        />
      </View>
    </ListRowSurface>
  );
}

export type { BudgetSuggestionRowProps };

const styles = StyleSheet.create({
  row: {
    justifyContent: "space-between",
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
  amountField: {
    gap: 0,
  },
  hiddenLabel: {
    display: "none",
  },
  amountInput: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 64,
    textAlign: "right",
    minHeight: 36,
  },
});
