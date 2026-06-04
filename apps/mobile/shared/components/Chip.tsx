import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { Pressable, StyleSheet, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassSurface } from "./GlassSurface";

type ChipTone = "neutral" | "primary" | "success" | "danger" | "warning";

type ChipProps = Omit<ViewProps, "children"> & {
  label: string;
  tone?: ChipTone;
  selected?: boolean;
  leading?: ReactNode;
  onPress?: PressableProps["onPress"];
  className?: string;
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
  selected = false,
  leading,
  onPress,
  className,
  ...viewProps
}: ChipProps) {
  const accentGreen = useThemeColor("accentGreen");
  const success = useThemeColor("success");
  const danger = useThemeColor("danger");
  const warning = useThemeColor("warning");
  const toneBorderColor: Record<ChipTone, string | undefined> = {
    neutral: undefined,
    primary: accentGreen,
    success,
    danger,
    warning,
  };
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
      <Text className={`font-poppins-medium text-caption ${LABEL_CLASS_NAMES[tone]}`}>{label}</Text>
    </>
  );
  const content = (
    <GlassSurface
      {...contentProps}
      className={className}
      padded={false}
      radius={999}
      style={[
        styles.surface,
        toneBorderColor[tone] ? { borderColor: toneBorderColor[tone] } : null,
        selected ? styles.selectedSurface : null,
        contentProps.style,
      ]}
    >
      {contentBody}
    </GlassSurface>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable {...pressableProps} onPress={onPress}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  selectedSurface: {
    borderWidth: 1.5,
  },
});
