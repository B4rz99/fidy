import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { Plus } from "@/shared/components/icons";
import { StyleSheet } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";

type AddActionButtonProps = Omit<PressableProps, "children"> & {
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly iconColor?: string;
  readonly iconSize?: number;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
};

export function AddActionButton({
  accessibilityRole,
  backgroundColor,
  borderColor,
  hitSlop = 12,
  iconColor,
  iconSize = 24,
  size = 44,
  style,
  ...pressableProps
}: AddActionButtonProps) {
  const defaultIconColor = useThemeColor("primary");

  return (
    <GlassPressable
      {...pressableProps}
      accessibilityRole={accessibilityRole ?? "button"}
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      hitSlop={hitSlop}
      isInteractive
      padded={false}
      radius={size / 2}
      style={[styles.pressable, style]}
      surfaceLayoutStyle={[styles.surface, { height: size, width: size }]}
    >
      <Plus size={iconSize} color={iconColor ?? defaultIconColor} />
    </GlassPressable>
  );
}

export type { AddActionButtonProps };

const styles = StyleSheet.create({
  pressable: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  surface: {
    alignItems: "center",
    justifyContent: "center",
  },
});
