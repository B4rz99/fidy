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
  primary: "bg-action-primary dark:bg-action-primary-dark",
  secondary:
    "bg-surface dark:bg-surface-dark border border-border-subtle dark:border-border-subtle-dark",
  danger: "bg-danger dark:bg-danger-dark",
  ghost: "bg-transparent",
};

const LABEL_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "text-text-on-accent dark:text-text-on-accent-dark",
  secondary: "text-text-primary dark:text-text-primary-dark",
  danger: "text-white",
  ghost: "text-text-primary dark:text-text-primary-dark",
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
