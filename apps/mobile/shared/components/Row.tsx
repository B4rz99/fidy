import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type RowProps = Omit<ViewProps, "children"> & {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  destructive?: boolean;
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
  isLast = false,
  titleClassName,
  subtitleClassName,
  className,
  style,
  ...viewProps
}: RowProps) {
  const borderColor = useThemeColor("borderSubtle");
  const titleColorClassName = destructive
    ? "text-danger dark:text-danger-dark"
    : "text-text-primary dark:text-text-primary-dark";
  const content = (
    <View
      {...viewProps}
      className={`flex-row items-center px-4 py-3 ${disabled ? "opacity-50" : ""} ${
        className ?? ""
      }`}
      style={[
        {
          minHeight: 56,
          gap: 12,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: isLast ? "transparent" : borderColor,
        },
        style,
      ]}
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
    </View>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {content}
    </Pressable>
  );
}
