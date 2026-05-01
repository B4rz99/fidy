import { memo, useCallback } from "react";
import { FlatList, Pressable, Text, View } from "@/shared/components/rn";
import { SELECTABLE_ICONS } from "../../lib/icon-map";
import { styles } from "./CreateCategorySheet.styles";

const ICON_GRID_COLUMNS = 6;

type CategoryIconGridProps = {
  readonly accentGreen: string;
  readonly borderColor: string;
  readonly onSelect: (name: string) => void;
  readonly secondaryColor: string;
  readonly selectedColor: string | null;
  readonly selectedIcon: string | null;
};

type IconCellProps = {
  readonly accentGreen: string;
  readonly borderColor: string;
  readonly icon: string;
  readonly isSelected: boolean;
  readonly name: string;
  readonly onPress: (name: string) => void;
  readonly secondaryColor: string;
  readonly selectedColor: string | null;
};

const IconCell = memo(function IconCell({
  accentGreen,
  borderColor,
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
        <Text style={{ color: iconColor }}>{icon}</Text>
      </View>
    </Pressable>
  );
});

const iconKeyExtractor = (item: (typeof SELECTABLE_ICONS)[number]) => item.name;

export function CategoryIconGrid({
  accentGreen,
  borderColor,
  onSelect,
  secondaryColor,
  selectedColor,
  selectedIcon,
}: CategoryIconGridProps) {
  const renderItem = useCallback(
    ({ item }: { item: (typeof SELECTABLE_ICONS)[number] }) => (
      <IconCell
        accentGreen={accentGreen}
        borderColor={borderColor}
        icon={item.icon}
        isSelected={selectedIcon === item.name}
        name={item.name}
        onPress={onSelect}
        secondaryColor={secondaryColor}
        selectedColor={selectedColor}
      />
    ),
    [accentGreen, borderColor, onSelect, secondaryColor, selectedColor, selectedIcon]
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
