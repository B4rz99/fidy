import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { Platform, View } from "@/shared/components/rn";
import { useColorScheme } from "@/shared/hooks";
import { getSubtleGlassCardTokens } from "./card-tokens";
import { getSurfaceLayoutStyle } from "./surface-style";

type GlassSurfaceProps = ViewProps & {
  children: ReactNode;
  backgroundColor?: string;
  className?: string;
  isInteractive?: boolean;
  nativeGlass?: boolean;
  padded?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function GlassSurface({
  backgroundColor,
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
  const layoutStyle = getSurfaceLayoutStyle(style);
  const surfaceStyle = [
    {
      backgroundColor: backgroundColor ?? "transparent",
      borderCurve: "continuous" as const,
      borderRadius: radius,
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
