import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { Plus } from "@/shared/components/icons";
import { StyleSheet } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { SurfacePressable } from "./SurfacePressable";

type AddActionButtonProps = Omit<PressableProps, "children"> & {
  readonly iconColor?: string;
  readonly iconSize?: number;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
};

export function AddActionButton({
  accessibilityRole,
  hitSlop = 12,
  iconColor,
  iconSize = 24,
  size = 44,
  style,
  ...pressableProps
}: AddActionButtonProps) {
  const defaultIconColor = useThemeColor("primary");

  return (
    <SurfacePressable
      {...pressableProps}
      accessibilityRole={accessibilityRole ?? "button"}
      android_ripple={{ borderless: false }}
      hitSlop={hitSlop}
      isInteractive
      padded={false}
      radius={size / 2}
      style={style}
      surfaceLayoutStyle={[styles.surface, { height: size, width: size }]}
    >
      <Plus size={iconSize} color={iconColor ?? defaultIconColor} />
    </SurfacePressable>
  );
}

export type { AddActionButtonProps };

const styles = StyleSheet.create({
  surface: {
    alignItems: "center",
    justifyContent: "center",
  },
});
