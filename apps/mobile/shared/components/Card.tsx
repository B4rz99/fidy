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

type CardSurfaceProps = ViewProps & {
  readonly canUseLiquidGlass: boolean;
  readonly cardSurfaceStyle: StyleProp<ViewStyle>;
  readonly children: ReactNode;
  readonly colorScheme: "dark" | "light";
  readonly contentClassName: string;
  readonly contentStyle: StyleProp<ViewStyle>;
  readonly glassStyle: StyleProp<ViewStyle>;
  readonly isInteractive: boolean;
  readonly tintColor: string;
};

function CardSurface({
  canUseLiquidGlass,
  cardSurfaceStyle,
  children,
  colorScheme,
  contentClassName,
  contentStyle,
  glassStyle,
  isInteractive,
  tintColor,
  ...surfaceProps
}: CardSurfaceProps) {
  if (canUseLiquidGlass) {
    return (
      <GlassView
        {...surfaceProps}
        glassEffectStyle="clear"
        tintColor={tintColor}
        colorScheme={colorScheme}
        isInteractive={isInteractive}
        style={glassStyle}
      >
        <View className={contentClassName} style={contentStyle}>
          {children}
        </View>
      </GlassView>
    );
  }

  return (
    <View {...surfaceProps} style={cardSurfaceStyle}>
      <View className={contentClassName} style={contentStyle}>
        {children}
      </View>
    </View>
  );
}

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
  const innerClassName = `${resolvedContentClassName} ${disabled ? "opacity-60" : ""}`;
  const sharedSurfaceProps = {
    canUseLiquidGlass,
    cardSurfaceStyle,
    colorScheme: isDark ? ("dark" as const) : ("light" as const),
    contentClassName: innerClassName,
    contentStyle,
    glassStyle,
    isInteractive: onPress != null,
    tintColor: tokens.tintColor,
  };

  if (onPress == null) {
    return (
      <CardSurface {...viewProps} {...sharedSurfaceProps}>
        {children}
      </CardSurface>
    );
  }

  return (
    <Pressable {...pressableProps} onPress={onPress} disabled={disabled}>
      <CardSurface {...surfaceProps} {...sharedSurfaceProps}>
        {children}
      </CardSurface>
    </Pressable>
  );
}
