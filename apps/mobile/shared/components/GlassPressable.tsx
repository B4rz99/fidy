import type { ReactNode } from "react";
import type { PressableProps, PressableStateCallbackType } from "react-native";
import { Pressable } from "@/shared/components/rn";
import { GlassSurface } from "./GlassSurface";
import type { SurfaceLayoutStyle } from "./surface-style";

type GlassPressableProps = Omit<PressableProps, "children"> & {
  readonly backgroundColor?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabledOpacity?: number;
  readonly isInteractive?: boolean;
  readonly layoutStyle?: SurfaceLayoutStyle;
  readonly nativeGlass?: boolean;
  readonly padded?: boolean;
  readonly radius?: number;
  readonly surfaceClassName?: string;
  readonly surfaceLayoutStyle?: SurfaceLayoutStyle;
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
  children,
  className,
  disabled,
  disabledOpacity = 0.6,
  isInteractive = false,
  layoutStyle,
  nativeGlass = true,
  padded = false,
  radius,
  style,
  surfaceClassName,
  surfaceLayoutStyle,
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
        pointerEvents={isInteractive ? "auto" : "none"}
        backgroundColor={backgroundColor}
        isInteractive={isInteractive}
        nativeGlass={nativeGlass}
        padded={padded}
        radius={radius}
        className={surfaceClassName}
        style={layoutStyle ?? surfaceLayoutStyle}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}

export type { GlassPressableProps };
