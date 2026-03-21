import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Check, Ellipsis, type LucideIcon } from "@/shared/components/icons";
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { COLOR_SWATCHES, MAX_NAME_LENGTH, MIN_NAME_LENGTH } from "../lib/constants";
import { ICON_MAP, SELECTABLE_ICONS } from "../lib/icon-map";
import { useCategoriesStore } from "../store";

const ICON_GRID_COLUMNS = 6;

// ─── Memoized sub-components ────────────────────────────────────────

type IconCellProps = {
  name: string;
  icon: LucideIcon;
  isSelected: boolean;
  selectedColor: string | null;
  accentGreen: string;
  secondaryColor: string;
  borderColor: string;
  onPress: (name: string) => void;
};

const IconCell = React.memo(function IconCell({
  name,
  icon: Icon,
  isSelected,
  selectedColor,
  accentGreen,
  secondaryColor,
  borderColor,
  onPress,
}: IconCellProps) {
  const handlePress = useCallback(() => onPress(name), [name, onPress]);
  const activeBorder = selectedColor ?? accentGreen;
  const iconColor = isSelected ? activeBorder : secondaryColor;

  return (
    <Pressable onPress={handlePress} style={styles.iconCellWrapper}>
      <View
        style={[
          styles.iconCell,
          {
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? activeBorder : borderColor,
          },
        ]}
      >
        <Icon size={20} color={iconColor} />
      </View>
    </Pressable>
  );
});

type ColorSwatchProps = {
  color: string;
  isSelected: boolean;
  onPress: (color: string) => void;
};

const ColorSwatch = React.memo(function ColorSwatch({
  color,
  isSelected,
  onPress,
}: ColorSwatchProps) {
  const handlePress = useCallback(() => onPress(color), [color, onPress]);

  return (
    <Pressable onPress={handlePress}>
      <View style={[styles.swatch, { backgroundColor: color }]}>
        {isSelected ? <Check size={16} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
});

// ─── Icon grid key extractor ────────────────────────────────────────

const iconKeyExtractor = (item: (typeof SELECTABLE_ICONS)[number]) => item.name;

// ─── Main component ─────────────────────────────────────────────────

export function CreateCategorySheet() {
  const router = useRouter();
  const { t } = useTranslation();

  const pageBg = useThemeColor("page");
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const { isBusy, run: guardedCreate } = useAsyncGuard();

  const trimmedName = name.trim();
  const isFormValid =
    trimmedName.length >= MIN_NAME_LENGTH &&
    trimmedName.length <= MAX_NAME_LENGTH &&
    selectedIcon !== null &&
    selectedColor !== null;

  const handleIconSelect = useCallback((iconName: string) => {
    setSelectedIcon(iconName);
  }, []);

  const handleColorSelect = useCallback((color: string) => {
    setSelectedColor(color);
  }, []);

  const handleCreate = useCallback(() => {
    guardedCreate(async () => {
      const success = await useCategoriesStore.getState().createUserCategory({
        name: name.trim(),
        iconName: selectedIcon!,
        colorHex: selectedColor!,
      });
      if (success) router.back();
    });
  }, [name, selectedIcon, selectedColor, guardedCreate, router]);

  // Derive preview icon
  const PreviewIcon: LucideIcon = selectedIcon ? (ICON_MAP[selectedIcon] ?? Ellipsis) : Ellipsis;

  const renderIconCell = useCallback(
    ({ item }: { item: (typeof SELECTABLE_ICONS)[number] }) => (
      <IconCell
        name={item.name}
        icon={item.icon}
        isSelected={selectedIcon === item.name}
        selectedColor={selectedColor}
        accentGreen={accentGreen}
        secondaryColor={secondaryColor}
        borderColor={borderColor}
        onPress={handleIconSelect}
      />
    ),
    [selectedIcon, selectedColor, accentGreen, secondaryColor, borderColor, handleIconSelect]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: pageBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Sheet handle bar */}
      <View style={[styles.grabBar, { backgroundColor: tertiaryColor, opacity: 0.3 }]} />

      {/* Title */}
      <Text style={[styles.title, { color: primaryColor }]}>{t("categories.create.title")}</Text>

      {/* Preview pill */}
      <View style={styles.previewRow}>
        <View style={[styles.previewPill, { backgroundColor: selectedColor ?? accentGreen }]}>
          <PreviewIcon size={20} color="#FFFFFF" />
          <Text style={styles.previewText}>
            {trimmedName.length > 0 ? trimmedName : t("categories.create.namePlaceholder")}
          </Text>
        </View>
      </View>

      {/* Name input */}
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

      {/* Icon grid */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: secondaryColor }]}>
          {t("categories.create.iconLabel")}
        </Text>
        <FlatList
          data={SELECTABLE_ICONS}
          renderItem={renderIconCell}
          keyExtractor={iconKeyExtractor}
          numColumns={ICON_GRID_COLUMNS}
          scrollEnabled={false}
          contentContainerStyle={styles.iconGridContent}
          columnWrapperStyle={styles.iconGridRow}
        />
      </View>

      {/* Color swatches */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: secondaryColor }]}>
          {t("categories.create.colorLabel")}
        </Text>
        <View style={styles.swatchGrid}>
          {COLOR_SWATCHES.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              isSelected={selectedColor === color}
              onPress={handleColorSelect}
            />
          ))}
        </View>
      </View>

      {/* Create button */}
      <Pressable
        style={[
          styles.createButton,
          {
            backgroundColor: accentGreen,
            opacity: !isFormValid || isBusy ? 0.5 : 1,
          },
        ]}
        onPress={handleCreate}
        disabled={!isFormValid || isBusy}
      >
        <Text style={styles.createButtonText}>{t("categories.create.submit")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  grabBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  previewRow: { alignItems: "center" },
  previewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 48,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 14,
    paddingRight: 20,
    borderRadius: 24,
  },
  previewText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  input: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
  },
  iconGridContent: { gap: 8 },
  iconGridRow: { gap: 8, justifyContent: "flex-start" },
  iconCellWrapper: { flex: 1, maxWidth: 44, alignItems: "center" },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  createButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
