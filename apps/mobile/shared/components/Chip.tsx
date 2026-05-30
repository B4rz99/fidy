import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { Pressable, Text, View } from "@/shared/components/rn";

type ChipTone = "neutral" | "primary" | "success" | "danger" | "warning";

type ChipProps = Omit<ViewProps, "children"> & {
  label: string;
  tone?: ChipTone;
  selected?: boolean;
  leading?: ReactNode;
  onPress?: PressableProps["onPress"];
  className?: string;
};

const CHIP_CLASS_NAMES: Record<ChipTone, string> = {
  neutral: "bg-surface-muted dark:bg-surface-muted-dark",
  primary: "bg-action-primary dark:bg-action-primary-dark",
  success: "bg-success dark:bg-success-dark",
  danger: "bg-danger dark:bg-danger-dark",
  warning: "bg-warning dark:bg-warning-dark",
};

const LABEL_CLASS_NAMES: Record<ChipTone, string> = {
  neutral: "text-text-primary dark:text-text-primary-dark",
  primary: "text-text-on-accent dark:text-text-on-accent-dark",
  success: "text-text-on-accent dark:text-text-on-accent-dark",
  danger: "text-white",
  warning: "text-white",
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
  const contentClassName = `h-8 flex-row items-center justify-center rounded-full px-3 ${
    CHIP_CLASS_NAMES[tone]
  } ${selected ? "border border-border-strong dark:border-border-strong-dark" : ""} ${
    className ?? ""
  }`;
  const content = (
    <View {...contentProps} className={contentClassName} style={[{ gap: 6 }, contentProps.style]}>
      {leading}
      <Text className={`font-poppins-medium text-caption ${LABEL_CLASS_NAMES[tone]}`}>{label}</Text>
    </View>
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
