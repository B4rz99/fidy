import { memo, useCallback } from "react";
import { Check } from "@/shared/components/icons";
import { Pressable, View } from "@/shared/components/rn";
import { COLOR_SWATCHES } from "../../lib/constants";
import { styles } from "./CreateCategoryScreen.styles";

type CategoryColorSwatchesProps = {
  readonly onSelect: (color: string) => void;
  readonly selectedColor: string | null;
};

type ColorSwatchProps = {
  readonly color: string;
  readonly isSelected: boolean;
  readonly onPress: (color: string) => void;
};

const ColorSwatch = memo(function ColorSwatch({ color, isSelected, onPress }: ColorSwatchProps) {
  const handlePress = useCallback(() => onPress(color), [color, onPress]);

  return (
    <Pressable onPress={handlePress}>
      <View style={[styles.swatch, { backgroundColor: color }]}>
        {isSelected ? <Check size={16} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
});

export function CategoryColorSwatches({ onSelect, selectedColor }: CategoryColorSwatchesProps) {
  return (
    <View style={styles.swatchGrid}>
      {COLOR_SWATCHES.map((color) => (
        <ColorSwatch
          key={color}
          color={color}
          isSelected={selectedColor === color}
          onPress={onSelect}
        />
      ))}
    </View>
  );
}
