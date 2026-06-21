import { Button, FormScreen, FormSection, FormTextField } from "@/shared/components";
import { Pencil, Smile } from "@/shared/components/icons";
import { Keyboard, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { MAX_NAME_LENGTH } from "../../lib/constants";
import { CategoryColorSwatches } from "./CategoryColorSwatches";
import { CategoryIconGrid } from "./CategoryIconGrid";
import { styles } from "./CreateCategoryScreen.styles";
import type { CreateCategoryScreenViewModel } from "./CreateCategoryScreen.types";

type CreateCategoryScreenContentProps = CreateCategoryScreenViewModel & {
  readonly headerTitle: string;
  readonly onBack: () => void;
};

export function CreateCategoryScreenContent({
  canSubmit,
  customEmoji,
  handleCreate,
  handleColorSelect,
  handleCustomEmojiChange,
  handleIconSelect,
  isBusy,
  name,
  previewIcon,
  selectedColor,
  selectedIcon,
  setName,
  trimmedName,
  headerTitle,
  onBack,
}: CreateCategoryScreenContentProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const surface = useThemeColor("surface");

  return (
    <FormScreen
      contentContainerStyle={styles.scrollContent}
      headerTitle={headerTitle}
      horizontalPadding={24}
      keyboardDismissMode="interactive"
      onBack={onBack}
      topPadding={12}
    >
      <View style={styles.previewRow}>
        <View style={[styles.previewPill, { backgroundColor: surface }]}>
          <Text style={styles.previewIcon}>{previewIcon}</Text>
          {trimmedName.length > 0 ? (
            <Text style={[styles.previewText, { color: primaryColor }]}>{trimmedName}</Text>
          ) : null}
        </View>
      </View>

      <FormTextField
        icon={Pencil}
        label={t("categories.create.nameLabel")}
        value={name}
        onChangeText={setName}
        maxLength={MAX_NAME_LENGTH}
        onSubmitEditing={Keyboard.dismiss}
        returnKeyType="done"
        style={styles.fieldGroup}
        labelStyle={[styles.fieldLabel, { color: secondaryColor }]}
        inputStyle={[styles.input, { color: primaryColor }]}
      />

      <FormSection title={t("categories.create.iconLabel")}>
        <FormTextField
          icon={Smile}
          label={t("categories.create.customEmojiLabel")}
          value={customEmoji}
          onChangeText={handleCustomEmojiChange}
          maxLength={16}
          returnKeyType="done"
          style={styles.customEmojiField}
          labelStyle={[styles.fieldLabel, { color: secondaryColor }]}
          inputStyle={[styles.input, styles.customEmojiInput, { color: primaryColor }]}
        />
        <CategoryIconGrid
          accentGreen={accentGreen}
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
