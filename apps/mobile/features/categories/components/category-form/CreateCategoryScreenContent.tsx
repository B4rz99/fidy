import { Keyboard } from "react-native";
import { Button, FormScreen, FormSection, FormTextField } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { MAX_NAME_LENGTH } from "../../lib/constants";
import { CategoryColorSwatches } from "./CategoryColorSwatches";
import { CategoryIconGrid } from "./CategoryIconGrid";
import { styles } from "./CreateCategoryScreen.styles";
import type { CreateCategoryScreenViewModel } from "./CreateCategoryScreen.types";

export function CreateCategoryScreenContent({
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
}: CreateCategoryScreenViewModel) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <FormScreen
      contentContainerStyle={styles.scrollContent}
      horizontalPadding={24}
      keyboardDismissMode="interactive"
      topPadding={12}
    >
      <View style={styles.previewRow}>
        <View style={[styles.previewPill, { backgroundColor: selectedColor ?? accentGreen }]}>
          <Text>{previewIcon}</Text>
          <Text style={styles.previewText}>
            {trimmedName.length > 0 ? trimmedName : t("categories.create.namePlaceholder")}
          </Text>
        </View>
      </View>

      <FormTextField
        label={t("categories.create.nameLabel")}
        value={name}
        onChangeText={setName}
        maxLength={MAX_NAME_LENGTH}
        onSubmitEditing={Keyboard.dismiss}
        placeholder={t("categories.create.namePlaceholder")}
        returnKeyType="done"
        style={styles.fieldGroup}
        labelStyle={[styles.fieldLabel, { color: secondaryColor }]}
        inputStyle={[styles.input, { backgroundColor: cardBg, color: primaryColor }]}
      />

      <FormSection title={t("categories.create.iconLabel")}>
        <CategoryIconGrid
          accentGreen={accentGreen}
          borderColor={borderColor}
          onSelect={handleIconSelect}
          secondaryColor={secondaryColor}
          selectedColor={selectedColor}
          selectedIcon={selectedIcon}
        />
      </FormSection>

      <FormSection title={t("categories.create.colorLabel")}>
        <CategoryColorSwatches onSelect={handleColorSelect} selectedColor={selectedColor} />
      </FormSection>

      <Button
        label={t("categories.create.submit")}
        disabled={!canSubmit || isBusy}
        loading={isBusy}
        onPress={handleCreate}
      />
    </FormScreen>
  );
}
