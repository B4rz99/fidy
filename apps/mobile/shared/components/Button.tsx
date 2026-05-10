import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { ActivityIndicator, Pressable, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
};

const CONTAINER_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "bg-accent-green dark:bg-accent-green-dark",
  secondary: "bg-card dark:bg-card-dark border border-border-subtle dark:border-border-subtle-dark",
  danger: "bg-accent-red dark:bg-accent-red-dark",
  ghost: "bg-transparent",
};

const LABEL_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "text-white dark:text-page-dark",
  secondary: "text-primary dark:text-primary-dark",
  danger: "text-white",
  ghost: "text-primary dark:text-primary-dark",
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  icon,
  disabled,
  className,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const onAccent = useThemeColor("onAccent");

  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      className={`h-[52px] flex-row items-center justify-center gap-2 rounded-xl px-4 ${CONTAINER_CLASS_NAMES[variant]} ${
        isDisabled ? "opacity-60" : ""
      } ${className ?? ""}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? undefined : onAccent} />
      ) : (
        icon
      )}
      <Text className={`font-poppins-semibold text-section ${LABEL_CLASS_NAMES[variant]}`}>
        {label}
      </Text>
    </Pressable>
  );
}
