import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { Text, View } from "@/shared/components/rn";

type EmptyStateProps = Omit<ViewProps, "children"> & {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  subtitle,
  icon,
  action,
  className,
  style,
  ...viewProps
}: EmptyStateProps) {
  return (
    <View
      {...viewProps}
      className={`flex-1 items-center justify-center px-8 ${className ?? ""}`}
      style={[{ gap: 8 }, style]}
    >
      {icon}
      <Text className="text-center font-poppins-bold text-title text-text-primary dark:text-text-primary-dark">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-center font-poppins-medium text-label text-text-secondary dark:text-text-secondary-dark">
          {subtitle}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
