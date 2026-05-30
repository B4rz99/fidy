import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { GlassSurface } from "./GlassSurface";
import { Pressable } from "./rn";

type CardProps = ViewProps & {
  children: ReactNode;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  padded?: boolean;
  className?: string;
};

export function Card({
  children,
  onPress,
  disabled = false,
  padded = true,
  className,
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
  const content = (
    <GlassSurface {...viewProps} background="card" padded={padded} className={className}>
      {children}
    </GlassSurface>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable {...pressableProps} onPress={onPress} disabled={disabled}>
      <GlassSurface
        {...surfaceProps}
        background="card"
        padded={padded}
        className={`${disabled ? "opacity-60" : ""} ${className ?? ""}`}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}
