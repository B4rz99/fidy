import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { GlassSurface } from "./GlassSurface";
import { Pressable, View } from "./rn";

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
  const resolvedContentClassName = `${padded ? "p-4" : ""} ${contentClassName ?? ""}`;
  const innerClassName = `${resolvedContentClassName} ${disabled ? "opacity-60" : ""}`;
  const surfaceViewProps = onPress == null ? viewProps : surfaceProps;
  const surface = (
    <GlassSurface
      {...surfaceViewProps}
      isInteractive={onPress != null && !disabled}
      padded={false}
      radius={16}
      style={surfaceStyleOverride}
    >
      <View className={innerClassName} style={contentStyle}>
        {children}
      </View>
    </GlassSurface>
  );

  if (onPress == null) {
    return surface;
  }

  return (
    <Pressable {...pressableProps} onPress={onPress} disabled={disabled}>
      {surface}
    </Pressable>
  );
}
