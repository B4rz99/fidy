import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { ActivityIndicator, StyleSheet, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { SurfacePressable } from "./SurfacePressable";

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
  primary: "",
  secondary: "",
  danger: "",
  dangerSecondary: "",
  ghost: "",
};

const LABEL_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "text-accent-green dark:text-accent-green-dark",
  secondary: "text-text-primary dark:text-text-primary-dark",
  danger: "text-accent-red dark:text-accent-red-dark",
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
  style,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const loadingIndicatorColor =
    variant === "secondary" || variant === "dangerSecondary" || variant === "ghost"
      ? undefined
      : variant === "danger"
        ? accentRed
        : accentGreen;
  const content = (
    <>
      {loading ? <ActivityIndicator color={loadingIndicatorColor} /> : icon}
      <Text
        adjustsFontSizeToFit
        className={`text-center font-poppins-semibold ${LABEL_SIZE_CLASS_NAMES[size]} ${LABEL_CLASS_NAMES[variant]}`}
        minimumFontScale={0.72}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  return (
    <SurfacePressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      disabled={isDisabled}
      style={style}
      radius={12}
      surfaceLayoutStyle={styles.surfaceContent}
      className={`${SIZE_CLASS_NAMES[size]} ${CONTAINER_CLASS_NAMES[variant]} ${
        isDisabled ? "opacity-60" : ""
      } ${className ?? ""}`}
    >
      {content}
    </SurfacePressable>
  );
}

const styles = StyleSheet.create({
  surfaceContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
});
