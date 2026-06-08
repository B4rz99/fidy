import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";

type ButtonVariant = "primary" | "secondary" | "danger" | "dangerSecondary" | "ghost";
type ButtonSize = "default" | "compact";

type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  borderColor?: string;
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
  borderColor,
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
  const usesGlassSurface = variant !== "ghost";
  const semanticBorderColor =
    borderColor ??
    (variant === "primary"
      ? accentGreen
      : variant === "danger" || variant === "dangerSecondary"
        ? accentRed
        : undefined);
  const content = (
    <>
      {loading ? <ActivityIndicator color={loadingIndicatorColor} /> : icon}
      <Text
        className={`text-center font-poppins-semibold ${LABEL_SIZE_CLASS_NAMES[size]} ${LABEL_CLASS_NAMES[variant]}`}
      >
        {label}
      </Text>
    </>
  );

  if (!usesGlassSurface) {
    return (
      <Pressable
        {...pressableProps}
        accessibilityRole={pressableProps.accessibilityRole ?? "button"}
        disabled={isDisabled}
        style={style}
        className={`${SIZE_CLASS_NAMES[size]} flex-row items-center justify-center gap-2 rounded-xl px-4 ${
          CONTAINER_CLASS_NAMES[variant]
        } ${isDisabled ? "opacity-60" : ""} ${className ?? ""}`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <GlassPressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      disabled={isDisabled}
      style={style}
      nativeGlass={false}
      radius={12}
      borderColor={semanticBorderColor}
      surfaceStyle={styles.glassContent}
      className={`${SIZE_CLASS_NAMES[size]} ${CONTAINER_CLASS_NAMES[variant]} ${
        isDisabled ? "opacity-60" : ""
      } ${className ?? ""}`}
    >
      {content}
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  glassContent: {
    alignItems: "center",
    backgroundColor: "transparent",
    flexDirection: "row",
    gap: 8,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
});
