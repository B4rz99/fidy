import type { ReactNode } from "react";
import type { PressableProps, PressableStateCallbackType } from "react-native";
import { Pressable, StyleSheet, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type TextActionButtonTone = "primary" | "danger" | "neutral";

type TextActionButtonProps = Omit<PressableProps, "children"> & {
  readonly label: string;
  readonly tone?: TextActionButtonTone;
  readonly appearance?: "pill" | "plain";
  readonly icon?: ReactNode;
  readonly className?: string;
};

export function TextActionButton({
  label,
  appearance = "pill",
  tone = "primary",
  icon,
  className,
  style,
  ...pressableProps
}: TextActionButtonProps) {
  const actionPrimary = useThemeColor("actionPrimary");
  const borderSubtle = useThemeColor("borderSubtle");
  const danger = useThemeColor("danger");
  const secondary = useThemeColor("secondary");
  const surface = useThemeColor("surface");
  const labelColor = tone === "danger" ? danger : tone === "neutral" ? secondary : actionPrimary;
  const isPill = appearance === "pill";
  const baseStyle = [
    styles.button,
    isPill ? styles.pill : styles.plain,
    { backgroundColor: surface },
    isPill ? { borderColor: borderSubtle } : null,
    pressableProps.disabled ? styles.disabled : null,
  ];
  const pressableStyle =
    typeof style === "function"
      ? (state: PressableStateCallbackType) => [...baseStyle, style(state)]
      : [...baseStyle, style];

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      className={className}
      style={pressableStyle}
    >
      {icon}
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

export type { TextActionButtonProps, TextActionButtonTone };

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
  },
  pill: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  plain: {
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});
