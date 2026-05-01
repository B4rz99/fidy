import { Keyboard } from "react-native";
import { Pressable, ScrollView, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { MAX_NAME_LENGTH } from "../../lib/constants";
import { CategoryColorSwatches } from "./CategoryColorSwatches";
import { CategoryIconGrid } from "./CategoryIconGrid";
import { styles } from "./CreateCategorySheet.styles";
import type { CreateCategorySheetViewModel } from "./CreateCategorySheet.types";

export function CreateCategorySheetContent({
  canSubmit,
  handleCreate,
  handleColorSelect,
  handleIconSelect,
  isBusy,
  name,
  previewIcon,
  selectedColor,
  selectedIcon,
  setName,
  trimmedName,
}: CreateCategorySheetViewModel) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const cardBg = useThemeColor("card");
  const pageBg = useThemeColor("page");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: pageBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      bounces={false}
    >
      <View style={[styles.grabBar, { backgroundColor: tertiaryColor, opacity: 0.3 }]} />

      <Text style={[styles.title, { color: primaryColor }]}>{t("categories.create.title")}</Text>

      <View style={styles.previewRow}>
        <View style={[styles.previewPill, { backgroundColor: selectedColor ?? accentGreen }]}>
          <Text>{previewIcon}</Text>
          <Text style={styles.previewText}>
            {trimmedName.length > 0 ? trimmedName : t("categories.create.namePlaceholder")}
          </Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: secondaryColor }]}>
          {t("categories.create.nameLabel")}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, color: primaryColor }]}
          placeholder={t("categories.create.namePlaceholder")}
          placeholderTextColor={tertiaryColor}
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME_LENGTH}
          onSubmitEditing={Keyboard.dismiss}
          returnKeyType="done"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: secondaryColor }]}>
          {t("categories.create.iconLabel")}
        </Text>
        <CategoryIconGrid
          accentGreen={accentGreen}
          borderColor={borderColor}
          onSelect={handleIconSelect}
          secondaryColor={secondaryColor}
          selectedColor={selectedColor}
          selectedIcon={selectedIcon}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: secondaryColor }]}>
          {t("categories.create.colorLabel")}
        </Text>
        <CategoryColorSwatches onSelect={handleColorSelect} selectedColor={selectedColor} />
      </View>

      <Pressable
        style={[
          styles.createButton,
          {
            backgroundColor: accentGreen,
            opacity: !canSubmit || isBusy ? 0.5 : 1,
          },
        ]}
        onPress={handleCreate}
        disabled={!canSubmit || isBusy}
      >
        <Text style={styles.createButtonText}>{t("categories.create.submit")}</Text>
      </Pressable>
    </ScrollView>
  );
}
