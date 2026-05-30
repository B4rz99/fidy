import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { X } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { IconActionButton } from "./IconActionButton";

type CalloutTone = "neutral" | "success" | "danger" | "warning";

type BaseCalloutProps = Omit<ViewProps, "children"> & {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  tone?: CalloutTone;
  onPress?: PressableProps["onPress"];
  className?: string;
};

type CalloutProps = BaseCalloutProps &
  (
    | {
        onDismiss: NonNullable<PressableProps["onPress"]>;
        dismissAccessibilityLabel: string;
      }
    | {
        onDismiss?: undefined;
        dismissAccessibilityLabel?: never;
      }
  );

const CALLOUT_CLASS_NAMES: Record<CalloutTone, string> = {
  neutral:
    "bg-surface dark:bg-surface-dark border border-border-subtle dark:border-border-subtle-dark",
  success: "bg-accent-green-light dark:bg-accent-green-light-dark",
  danger: "bg-accent-red-light dark:bg-accent-red-light-dark",
  warning: "bg-surface-muted dark:bg-surface-muted-dark",
};

const CALLOUT_TITLE_CLASS_NAMES: Record<CalloutTone, string> = {
  neutral: "text-text-primary dark:text-text-primary-dark",
  success: "text-[#244A13] dark:text-text-primary-dark",
  danger: "text-[#7A1E1E] dark:text-text-primary-dark",
  warning: "text-[#6A4000] dark:text-text-primary-dark",
};

const CALLOUT_SUBTITLE_CLASS_NAMES: Record<CalloutTone, string> = {
  neutral: "text-text-secondary dark:text-text-secondary-dark",
  success: "text-[#3F602C] dark:text-text-secondary-dark",
  danger: "text-[#8A3A3A] dark:text-text-secondary-dark",
  warning: "text-[#6D5A3A] dark:text-text-secondary-dark",
};

export function Callout({
  title,
  subtitle,
  icon,
  trailing,
  tone = "neutral",
  onPress,
  onDismiss,
  dismissAccessibilityLabel,
  className,
  ...viewProps
}: CalloutProps) {
  const secondaryColor = useThemeColor("secondary");
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
  const handleDismiss: PressableProps["onPress"] | undefined = onDismiss
    ? (event) => {
        event.stopPropagation?.();
        onDismiss(event);
      }
    : undefined;
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
        <Text className={`font-poppins-bold text-body ${CALLOUT_TITLE_CLASS_NAMES[tone]}`}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            className={`font-poppins-medium text-caption ${CALLOUT_SUBTITLE_CLASS_NAMES[tone]}`}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {handleDismiss ? (
        <IconActionButton
          accessibilityLabel={dismissAccessibilityLabel}
          icon={<X size={16} color={secondaryColor} />}
          onPress={handleDismiss}
          size="size-8"
        />
      ) : null}
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
