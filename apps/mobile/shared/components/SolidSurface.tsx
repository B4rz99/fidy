import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { StyleSheet, View } from "@/shared/components/rn";
import { useColorScheme } from "@/shared/hooks";
import { getSubtleSurfaceTokens } from "./surface-tokens";
import { getSurfaceLayoutStyle } from "./surface-style";

type SolidSurfaceProps = ViewProps & {
  children: ReactNode;
  backgroundColor?: string;
  className?: string;
  isInteractive?: boolean;
  padded?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SolidSurface({
  backgroundColor,
  children,
  className,
  isInteractive = false,
  padded = true,
  radius = 16,
  style,
  ...viewProps
}: SolidSurfaceProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const tokens = getSubtleSurfaceTokens(isDark);
  const solidSurfaceKey = isInteractive ? "interactive" : "static";
  const layoutStyle = getSurfaceLayoutStyle(style);
  const surfaceStyle = [
    {
      backgroundColor: backgroundColor ?? tokens.backgroundColor,
      borderColor: tokens.borderColor,
      borderCurve: "continuous" as const,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden" as const,
      padding: padded ? 16 : 0,
    },
    layoutStyle,
  ];

  return (
    <View key={solidSurfaceKey} {...viewProps} className={className} style={surfaceStyle}>
      {children}
    </View>
  );
}

export type { SolidSurfaceProps };
