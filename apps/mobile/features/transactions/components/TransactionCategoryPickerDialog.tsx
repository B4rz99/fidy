import { DialogCancelButton, DialogFrame, DialogPanel, DialogTitle } from "@/shared/components";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import type { Category } from "../lib/categories";
import { CATEGORIES } from "../lib/categories";
import { pickerStyles } from "./TransactionEntryPickers.styles";

export function TransactionCategoryPickerDialog(props: {
  readonly categoryId: Category["id"] | null;
  readonly locale: string;
  readonly onClose: () => void;
  readonly onSelect: (categoryId: Category["id"]) => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");

  return (
    <DialogFrame visible={props.visible} testID="category-picker.backdrop" onClose={props.onClose}>
      <DialogPanel maxHeight="72%">
        <DialogTitle>{t("common.category")}</DialogTitle>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            {CATEGORIES.map((category) => {
              const isSelected = category.id === props.categoryId;
              return (
                <Pressable
                  key={category.id}
                  style={[
                    pickerStyles.selectedRow,
                    {
                      borderColor: isSelected ? accentGreen : borderSubtle,
                      backgroundColor: card,
                    },
                  ]}
                  onPress={() => props.onSelect(category.id)}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 20 }}>{category.icon}</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: primary,
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 15,
                    }}
                  >
                    {getCategoryLabel(category, props.locale)}
                  </Text>
                  {isSelected ? (
                    <Text style={{ color: accentGreen, fontFamily: "Poppins_700Bold" }}>✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <DialogCancelButton onPress={props.onClose} />
      </DialogPanel>
    </DialogFrame>
  );
}
