import type { Category } from "@/shared/categories";
import {
  DialogActionButton,
  DialogActionStack,
  DialogFrame,
  DialogPanel,
  DialogTitle,
  FormTextField,
  SurfacePressable,
} from "@/shared/components";
import { Check, Smile } from "@/shared/components/icons";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n/locale-helpers";
import { getReadableSwatchCheckColor } from "../lib/color-swatch";
import { COLOR_SWATCHES } from "../lib/constants";
import { normalizeCategoryEmoji, SELECTABLE_ICONS } from "../lib/icon-map";

type CategoryEmojiDialogProps = {
  readonly category: Category | null;
  readonly color: string | null;
  readonly emoji: string;
  readonly isSaving: boolean;
  readonly onClose: () => void;
  readonly onColorChange: (color: string) => void;
  readonly onEmojiChange: (emoji: string) => void;
  readonly onResetColor: () => void;
  readonly onResetEmoji: () => void;
  readonly onSave: () => void;
};

export function CategoryEmojiDialog({
  category,
  color,
  emoji,
  isSaving,
  onClose,
  onColorChange,
  onEmojiChange,
  onResetColor,
  onResetEmoji,
  onSave,
}: CategoryEmojiDialogProps) {
  const { t, locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const surfaceMuted = useThemeColor("surfaceMuted");
  const normalizedEmoji = normalizeCategoryEmoji(emoji);
  const selectedColor = color ?? category?.color ?? accentGreen;
  const visible = category != null;
  const categoryLabel = category ? getCategoryLabel(category, locale) : "";

  return (
    <DialogFrame visible={visible} testID="category-emoji.backdrop" onClose={onClose}>
      <DialogPanel maxHeight="88%" showHandle>
        <ScrollView
          style={styles.dialogScroll}
          contentContainerStyle={styles.dialogContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <DialogTitle>{t("categories.appearance.title", { category: categoryLabel })}</DialogTitle>

          <View style={styles.previewRow}>
            <View style={[styles.previewCircle, { backgroundColor: surfaceMuted }]}>
              <Text style={styles.previewEmoji}>{normalizedEmoji || category?.icon}</Text>
            </View>
            <View style={styles.previewTextColumn}>
              <Text style={[styles.previewLabel, { color: secondary }]}>{categoryLabel}</Text>
              <View style={[styles.previewColorLine, { backgroundColor: selectedColor }]} />
            </View>
          </View>

          <FormTextField
            icon={Smile}
            label={t("categories.appearance.customEmojiLabel")}
            value={emoji}
            onChangeText={onEmojiChange}
            maxLength={16}
            placeholder="🙂"
            returnKeyType="done"
            labelStyle={[styles.fieldLabel, { color: secondary }]}
            inputStyle={[styles.input, { color: primary }]}
          />

          <View style={styles.presetSection}>
            <Text style={[styles.presetLabel, { color: secondary }]}>
              {t("categories.appearance.presetEmojiLabel")}
            </Text>
            <View style={styles.presetGrid}>
              {SELECTABLE_ICONS.map((item) => {
                const isSelected = normalizedEmoji === item.icon;
                return (
                  <SurfacePressable
                    key={item.name}
                    accessibilityLabel={item.icon}
                    onPress={() => onEmojiChange(item.icon)}
                    radius={12}
                    padded={false}
                    layoutStyle={styles.presetCell}
                  >
                    <View
                      style={[
                        styles.presetCellContent,
                        isSelected ? { borderColor: accentGreen, borderWidth: 2 } : null,
                      ]}
                    >
                      <Text style={styles.presetEmoji}>{item.icon}</Text>
                    </View>
                  </SurfacePressable>
                );
              })}
            </View>
          </View>

          <View style={styles.presetSection}>
            <Text style={[styles.presetLabel, { color: secondary }]}>
              {t("categories.appearance.colorLabel")}
            </Text>
            <View style={styles.colorGrid}>
              {COLOR_SWATCHES.map((item) => {
                const isSelected = selectedColor === item;
                return (
                  <SurfacePressable
                    key={item}
                    accessibilityLabel={item}
                    backgroundColor={item}
                    onPress={() => onColorChange(item)}
                    radius={18}
                    padded={false}
                    layoutStyle={styles.colorSwatch}
                  >
                    {isSelected ? (
                      <Check size={16} color={getReadableSwatchCheckColor(item)} />
                    ) : null}
                  </SurfacePressable>
                );
              })}
            </View>
          </View>

          <DialogActionStack>
            <DialogActionButton
              label={t("categories.appearance.save")}
              loading={isSaving}
              disabled={normalizedEmoji.length === 0 || color == null || isSaving}
              onPress={onSave}
            />
            <DialogActionButton
              label={t("categories.appearance.resetEmoji")}
              disabled={isSaving}
              variant="secondary"
              onPress={onResetEmoji}
            />
            <DialogActionButton
              label={t("categories.appearance.resetColor")}
              disabled={isSaving}
              variant="secondary"
              onPress={onResetColor}
            />
          </DialogActionStack>
        </ScrollView>
      </DialogPanel>
    </DialogFrame>
  );
}

const styles = StyleSheet.create({
  dialogScroll: {
    flexShrink: 1,
    width: "100%",
  },
  dialogContent: {
    gap: 12,
    paddingBottom: 4,
    width: "100%",
  },
  previewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  previewCircle: {
    alignItems: "center",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  previewEmoji: {
    fontSize: 28,
  },
  previewLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
  previewTextColumn: {
    flex: 1,
    gap: 8,
  },
  previewColorLine: {
    borderRadius: 999,
    height: 6,
    width: 64,
  },
  fieldLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  input: {
    fontFamily: "Poppins_500Medium",
    fontSize: 20,
  },
  presetSection: {
    gap: 10,
  },
  presetLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  presetCell: {
    height: 44,
    width: 44,
  },
  presetCellContent: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 12,
    borderWidth: 2,
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  presetEmoji: {
    fontSize: 20,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  colorSwatch: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
