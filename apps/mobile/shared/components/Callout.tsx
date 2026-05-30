import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { Pressable, Text, View } from "@/shared/components/rn";

type CalloutTone = "neutral" | "success" | "danger" | "warning";

type CalloutProps = Omit<ViewProps, "children"> & {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  tone?: CalloutTone;
  onPress?: PressableProps["onPress"];
  className?: string;
};

const CALLOUT_CLASS_NAMES: Record<CalloutTone, string> = {
  neutral:
    "bg-surface dark:bg-surface-dark border border-border-subtle dark:border-border-subtle-dark",
  success: "bg-accent-green-light dark:bg-accent-green-light-dark",
  danger: "bg-accent-red-light dark:bg-accent-red-light-dark",
  warning: "bg-surface-muted dark:bg-surface-muted-dark",
};

export function Callout({
  title,
  subtitle,
  icon,
  trailing,
  tone = "neutral",
  onPress,
  className,
  ...viewProps
}: CalloutProps) {
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
    accessibilityState,
    accessible,
    importantForAccessibility,
    testID,
  };
  const contentProps = onPress == null ? viewProps : containerProps;
  const content = (
    <View
      {...contentProps}
      className={`flex-row items-start rounded-chart px-4 py-4 ${CALLOUT_CLASS_NAMES[tone]} ${
        className ?? ""
      }`}
      style={[{ gap: 12 }, contentProps.style]}
    >
      {icon}
      <View className="flex-1" style={{ gap: 2 }}>
        <Text className="font-poppins-bold text-body text-text-primary dark:text-text-primary-dark">
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-poppins-medium text-caption text-text-secondary dark:text-text-secondary-dark">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
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
