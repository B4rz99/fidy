import { memo, useCallback } from "react";
import { SurfacePressable } from "@/shared/components";
import { Check } from "@/shared/components/icons";
import { View } from "@/shared/components/rn";
import { getReadableSwatchCheckColor } from "../../lib/color-swatch";
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
    <SurfacePressable
      onPress={handlePress}
      backgroundColor={color}
      radius={18}
      padded={false}
      layoutStyle={styles.swatch}
    >
      {isSelected ? <Check size={16} color={getReadableSwatchCheckColor(color)} /> : null}
    </SurfacePressable>
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
