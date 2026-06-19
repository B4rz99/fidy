import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { StyleSheet, Text } from "@/shared/components/rn";
import { GlassPressable } from "./GlassPressable";
import { GlassSurface } from "./GlassSurface";
import type { SurfaceLayoutStyle } from "./surface-style";

type ChipTone = "neutral" | "primary" | "success" | "danger" | "warning";

type ChipProps = Omit<ViewProps, "children" | "style"> & {
  label: string;
  tone?: ChipTone;
  size?: "default" | "compact";
  selected?: boolean;
  leading?: ReactNode;
  onPress?: PressableProps["onPress"];
  className?: string;
  labelClassName?: string;
  style?: SurfaceLayoutStyle;
};

const LABEL_CLASS_NAMES: Record<ChipTone, string> = {
  neutral: "text-text-primary dark:text-text-primary-dark",
  primary: "text-accent-green dark:text-accent-green-dark",
  success: "text-success dark:text-success-dark",
  danger: "text-danger dark:text-danger-dark",
  warning: "text-warning dark:text-warning-dark",
};

export function Chip({
  label,
  tone = "neutral",
  size = "default",
  selected = false,
  leading,
  onPress,
  className,
  labelClassName,
  ...viewProps
}: ChipProps) {
  const {
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    accessible,
    importantForAccessibility,
    testID,
    ...containerProps
  } = viewProps;
  const pressableProps = {
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole: accessibilityRole ?? (onPress ? "button" : undefined),
    accessibilityState: { ...accessibilityState, selected },
    accessible,
    importantForAccessibility,
    testID,
  };
  const contentProps = onPress == null ? viewProps : containerProps;
  const contentBody = (
    <>
      {leading}
      <Text
        className={`font-poppins-medium text-caption ${LABEL_CLASS_NAMES[tone]} ${labelClassName ?? ""}`}
      >
        {label}
      </Text>
    </>
  );
  const surfaceStyle = [
    styles.surface,
    size === "compact" ? styles.compactSurface : null,
    contentProps.style,
  ];
  const content = (
    <GlassSurface
      {...contentProps}
      className={className}
      padded={false}
      radius={999}
      style={surfaceStyle}
    >
      {contentBody}
    </GlassSurface>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <GlassPressable
      {...pressableProps}
      onPress={onPress}
      radius={999}
      surfaceClassName={className}
      surfaceLayoutStyle={surfaceStyle}
    >
      {contentBody}
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
  },
  compactSurface: {
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
