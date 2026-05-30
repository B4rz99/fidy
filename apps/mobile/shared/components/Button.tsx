import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { ActivityIndicator, Pressable, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type ButtonVariant = "primary" | "secondary" | "danger" | "dangerSecondary" | "ghost";
type ButtonSize = "default" | "compact";

type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
};

const CONTAINER_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "bg-action-primary dark:bg-action-primary-dark",
  secondary:
    "bg-surface dark:bg-surface-dark border border-border-subtle dark:border-border-subtle-dark",
  danger: "bg-danger dark:bg-danger-dark",
  dangerSecondary:
    "bg-surface dark:bg-surface-dark border border-accent-red/20 dark:border-accent-red-dark/20",
  ghost: "bg-transparent",
};

const LABEL_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "text-text-on-accent dark:text-text-on-accent-dark",
  secondary: "text-text-primary dark:text-text-primary-dark",
  danger: "text-white",
  dangerSecondary: "text-accent-red dark:text-accent-red-dark",
  ghost: "text-text-primary dark:text-text-primary-dark",
};

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  default: "h-[52px]",
  compact: "h-[42px]",
};

const LABEL_SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  default: "text-section",
  compact: "text-caption",
};

export function Button({
  label,
  variant = "primary",
  size = "default",
  loading = false,
  icon,
  disabled,
  className,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const onAccent = useThemeColor("onAccent");
  const loadingIndicatorColor =
    variant === "secondary" || variant === "dangerSecondary" || variant === "ghost"
      ? undefined
      : variant === "danger"
        ? "white"
        : onAccent;

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      disabled={isDisabled}
      className={`${SIZE_CLASS_NAMES[size]} flex-row items-center justify-center gap-2 rounded-xl px-4 ${CONTAINER_CLASS_NAMES[variant]} ${
        isDisabled ? "opacity-60" : ""
      } ${className ?? ""}`}
    >
      {loading ? <ActivityIndicator color={loadingIndicatorColor} /> : icon}
      <Text
        className={`text-center font-poppins-semibold ${LABEL_SIZE_CLASS_NAMES[size]} ${LABEL_CLASS_NAMES[variant]}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
