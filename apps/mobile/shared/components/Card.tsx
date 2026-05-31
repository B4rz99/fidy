import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { useColorScheme } from "@/shared/hooks";
import { getSubtleGlassCardTokens } from "./card-tokens";
import { Platform, Pressable, View } from "./rn";

type CardProps = Omit<ViewProps, "children" | "style"> & {
  children: ReactNode;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  padded?: boolean;
  contentClassName?: string;
  contentStyle?: StyleProp<ViewStyle>;
  surfaceStyle?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  onPress,
  disabled = false,
  padded = true,
  contentClassName,
  contentStyle,
  surfaceStyle: surfaceStyleOverride,
  ...viewProps
}: CardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const tokens = getSubtleGlassCardTokens(isDark);
  const {
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    accessible,
    importantForAccessibility,
    testID,
    ...surfaceProps
  } = viewProps;
  const pressableProps = {
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole: accessibilityRole ?? (onPress ? "button" : undefined),
    accessibilityState: { ...accessibilityState, disabled },
    accessible,
    importantForAccessibility,
    testID,
  };
  const cardSurfaceStyle = [
    {
      backgroundColor: tokens.fallbackBackgroundColor,
      borderColor: tokens.borderColor,
      borderCurve: "continuous" as const,
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden" as const,
    },
    surfaceStyleOverride,
  ];
  const glassStyle = [
    {
      borderColor: tokens.borderColor,
      borderCurve: "continuous" as const,
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden" as const,
    },
    surfaceStyleOverride,
  ];
  const canUseLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  const resolvedContentClassName = `${padded ? "p-4" : ""} ${contentClassName ?? ""}`;
  const content = canUseLiquidGlass ? (
    <GlassView
      {...viewProps}
      glassEffectStyle="clear"
      tintColor={tokens.tintColor}
      colorScheme={isDark ? "dark" : "light"}
      isInteractive={onPress != null}
      style={glassStyle}
    >
      <View className={resolvedContentClassName} style={contentStyle}>
        {children}
      </View>
    </GlassView>
  ) : (
    <View {...viewProps} style={cardSurfaceStyle}>
      <View className={resolvedContentClassName} style={contentStyle}>
        {children}
      </View>
    </View>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable {...pressableProps} onPress={onPress} disabled={disabled}>
      {canUseLiquidGlass ? (
        <GlassView
          {...surfaceProps}
          glassEffectStyle="clear"
          tintColor={tokens.tintColor}
          colorScheme={isDark ? "dark" : "light"}
          isInteractive
          style={glassStyle}
        >
          <View
            className={`${resolvedContentClassName} ${disabled ? "opacity-60" : ""}`}
            style={contentStyle}
          >
            {children}
          </View>
        </GlassView>
      ) : (
        <View {...surfaceProps} style={cardSurfaceStyle}>
          <View
            className={`${resolvedContentClassName} ${disabled ? "opacity-60" : ""}`}
            style={contentStyle}
          >
            {children}
          </View>
        </View>
      )}
    </Pressable>
  );
}
