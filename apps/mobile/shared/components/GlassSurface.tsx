import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { Platform, StyleSheet, View } from "@/shared/components/rn";
import { useColorScheme } from "@/shared/hooks";
import { getSubtleGlassCardTokens } from "./card-tokens";

type GlassSurfaceProps = ViewProps & {
  children: ReactNode;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  className?: string;
  isInteractive?: boolean;
  nativeGlass?: boolean;
  padded?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

function getLayoutStyle(style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return null;

  const {
    backgroundColor: _backgroundColor,
    borderBlockColor: _borderBlockColor,
    borderBlockEndColor: _borderBlockEndColor,
    borderBlockStartColor: _borderBlockStartColor,
    borderBottomColor: _borderBottomColor,
    borderBottomEndRadius: _borderBottomEndRadius,
    borderBottomLeftRadius: _borderBottomLeftRadius,
    borderBottomRightRadius: _borderBottomRightRadius,
    borderBottomStartRadius: _borderBottomStartRadius,
    borderBottomWidth: _borderBottomWidth,
    borderColor: _borderColor,
    borderCurve: _borderCurve,
    borderEndColor: _borderEndColor,
    borderEndWidth: _borderEndWidth,
    borderLeftColor: _borderLeftColor,
    borderLeftWidth: _borderLeftWidth,
    borderRadius: _borderRadius,
    borderRightColor: _borderRightColor,
    borderRightWidth: _borderRightWidth,
    borderStartColor: _borderStartColor,
    borderStartWidth: _borderStartWidth,
    borderTopColor: _borderTopColor,
    borderTopEndRadius: _borderTopEndRadius,
    borderTopLeftRadius: _borderTopLeftRadius,
    borderTopRightRadius: _borderTopRightRadius,
    borderTopStartRadius: _borderTopStartRadius,
    borderTopWidth: _borderTopWidth,
    borderWidth: _borderWidth,
    overflow: _overflow,
    ...layoutStyle
  } = flattened;

  return layoutStyle;
}

export function GlassSurface({
  backgroundColor,
  borderColor,
  borderWidth,
  children,
  className,
  isInteractive = false,
  nativeGlass = true,
  padded = true,
  radius = 16,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const tokens = getSubtleGlassCardTokens(isDark);
  const canUseLiquidGlass = nativeGlass && Platform.OS === "ios" && isLiquidGlassAvailable();
  const fallbackBackgroundColor =
    !nativeGlass && isDark ? "rgba(255, 255, 255, 0.10)" : tokens.fallbackBackgroundColor;
  const layoutStyle = getLayoutStyle(style);
  const surfaceStyle = [
    {
      backgroundColor: canUseLiquidGlass
        ? "transparent"
        : (backgroundColor ?? fallbackBackgroundColor),
      borderColor: borderColor ?? tokens.borderColor,
      borderCurve: "continuous" as const,
      borderRadius: radius,
      borderWidth: borderWidth ?? 1,
      overflow: "hidden" as const,
      padding: padded ? 16 : 0,
    },
    layoutStyle,
  ];

  if (canUseLiquidGlass) {
    return (
      <GlassView
        key={isInteractive ? "interactive" : "static"}
        {...viewProps}
        glassEffectStyle="clear"
        tintColor={tokens.tintColor}
        colorScheme={isDark ? "dark" : "light"}
        isInteractive={isInteractive}
        className={className}
        style={surfaceStyle}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View {...viewProps} className={className} style={surfaceStyle}>
      {children}
    </View>
  );
}

export type { GlassSurfaceProps };
