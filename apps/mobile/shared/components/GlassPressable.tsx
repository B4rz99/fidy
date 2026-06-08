import type { ReactNode } from "react";
import type {
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Pressable } from "@/shared/components/rn";
import { GlassSurface } from "./GlassSurface";

type GlassPressableProps = Omit<PressableProps, "children"> & {
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly borderWidth?: number;
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabledOpacity?: number;
  readonly nativeGlass?: boolean;
  readonly padded?: boolean;
  readonly radius?: number;
  readonly surfaceClassName?: string;
  readonly surfaceStyle?: StyleProp<ViewStyle>;
};

function getPressableStyle(
  disabled: boolean | null | undefined,
  disabledOpacity: number,
  style: PressableProps["style"]
) {
  const disabledStyle = disabled ? { opacity: disabledOpacity } : null;
  if (typeof style === "function") {
    return (state: PressableStateCallbackType) => [disabledStyle, style(state)];
  }
  return [disabledStyle, style];
}

export function GlassPressable({
  accessibilityRole,
  backgroundColor,
  borderColor,
  borderWidth,
  children,
  className,
  disabled,
  disabledOpacity = 0.6,
  nativeGlass = true,
  padded = false,
  radius,
  style,
  surfaceClassName,
  surfaceStyle,
  ...pressableProps
}: GlassPressableProps) {
  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={accessibilityRole ?? "button"}
      disabled={disabled}
      className={className}
      style={getPressableStyle(disabled, disabledOpacity, style)}
    >
      <GlassSurface
        pointerEvents="none"
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        borderWidth={borderWidth}
        nativeGlass={nativeGlass}
        padded={padded}
        radius={radius}
        className={surfaceClassName}
        style={surfaceStyle}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}

export type { GlassPressableProps };
