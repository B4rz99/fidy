import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { Text, View } from "@/shared/components/rn";
import { ListRowSurface } from "./ListRowSurface";

type RowProps = Omit<ViewProps, "children"> & {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  destructive?: boolean;
  divider?: boolean;
  isLast?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
  className?: string;
};

export function Row({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled = false,
  destructive = false,
  divider = true,
  isLast = false,
  titleClassName,
  subtitleClassName,
  className,
  style,
  ...viewProps
}: RowProps) {
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
  const titleColorClassName = destructive
    ? "text-danger dark:text-danger-dark"
    : "text-text-primary dark:text-text-primary-dark";
  const contentProps = onPress == null ? viewProps : containerProps;

  return (
    <ListRowSurface
      {...contentProps}
      onPress={onPress}
      disabled={disabled}
      divider={divider}
      isLast={isLast}
      variant="grouped"
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessible={accessible}
      importantForAccessibility={importantForAccessibility}
      testID={testID}
      contentStyle={style}
      className={className}
    >
      {leading}
      <View className="flex-1" style={{ gap: 2 }}>
        {typeof title === "string" ? (
          <Text className={`font-poppins text-body ${titleColorClassName} ${titleClassName ?? ""}`}>
            {title}
          </Text>
        ) : (
          title
        )}
        {typeof subtitle === "string" ? (
          <Text
            className={`font-poppins text-caption text-text-secondary dark:text-text-secondary-dark ${
              subtitleClassName ?? ""
            }`}
          >
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
    </ListRowSurface>
  );
}
