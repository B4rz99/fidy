import { memo, useCallback } from "react";
import { GlassPressable } from "@/shared/components";
import { FlatList, Text, View } from "@/shared/components/rn";
import { SELECTABLE_ICONS } from "../../lib/icon-map";
import { styles } from "./CreateCategoryScreen.styles";

const ICON_GRID_COLUMNS = 6;

type CategoryIconGridProps = {
  readonly accentGreen: string;
  readonly onSelect: (name: string) => void;
  readonly secondaryColor: string;
  readonly selectedColor: string | null;
  readonly selectedIcon: string | null;
};

type IconCellProps = {
  readonly accentGreen: string;
  readonly icon: string;
  readonly isSelected: boolean;
  readonly name: string;
  readonly onPress: (name: string) => void;
  readonly secondaryColor: string;
  readonly selectedColor: string | null;
};

const IconCell = memo(function IconCell({
  accentGreen,
  icon,
  isSelected,
  name,
  onPress,
  secondaryColor,
  selectedColor,
}: IconCellProps) {
  const handlePress = useCallback(() => onPress(name), [name, onPress]);
  const activeBorder = selectedColor ?? accentGreen;
  const iconColor = isSelected ? activeBorder : secondaryColor;

  return (
    <View style={styles.iconCellWrapper}>
      <GlassPressable
        onPress={handlePress}
        radius={12}
        padded={false}
        surfaceLayoutStyle={styles.iconCell}
      >
        <Text style={{ color: iconColor }}>{icon}</Text>
      </GlassPressable>
    </View>
  );
});

const iconKeyExtractor = (item: (typeof SELECTABLE_ICONS)[number]) => item.name;

export function CategoryIconGrid({
  accentGreen,
  onSelect,
  secondaryColor,
  selectedColor,
  selectedIcon,
}: CategoryIconGridProps) {
  const renderItem = useCallback(
    ({ item }: { item: (typeof SELECTABLE_ICONS)[number] }) => (
      <IconCell
        accentGreen={accentGreen}
        icon={item.icon}
        isSelected={selectedIcon === item.name}
        name={item.name}
        onPress={onSelect}
        secondaryColor={secondaryColor}
        selectedColor={selectedColor}
      />
    ),
    [accentGreen, onSelect, secondaryColor, selectedColor, selectedIcon]
  );

  return (
    <FlatList
      data={SELECTABLE_ICONS}
      renderItem={renderItem}
      keyExtractor={iconKeyExtractor}
      numColumns={ICON_GRID_COLUMNS}
      scrollEnabled={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.iconGridContent}
      columnWrapperStyle={styles.iconGridRow}
    />
  );
}
