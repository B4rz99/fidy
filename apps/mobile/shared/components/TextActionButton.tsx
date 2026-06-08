import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { Pressable, Text } from "@/shared/components/rn";

type TextActionButtonTone = "primary" | "danger" | "neutral";

type TextActionButtonProps = Omit<PressableProps, "children"> & {
  readonly label: string;
  readonly tone?: TextActionButtonTone;
  readonly appearance?: "pill" | "plain";
  readonly icon?: ReactNode;
  readonly className?: string;
};

const LABEL_CLASS_NAMES: Record<TextActionButtonTone, string> = {
  primary: "text-action-primary dark:text-action-primary-dark",
  danger: "text-danger dark:text-danger-dark",
  neutral: "text-text-secondary dark:text-text-secondary-dark",
};

export function TextActionButton({
  label,
  appearance = "pill",
  tone = "primary",
  icon,
  className,
  ...pressableProps
}: TextActionButtonProps) {
  const baseClassName =
    appearance === "pill"
      ? "min-h-8 flex-row items-center justify-center gap-1 rounded-full px-2"
      : "flex-row items-center justify-center gap-1";

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      className={`${baseClassName} ${className ?? ""}`}
    >
      {icon}
      <Text className={`font-poppins-medium text-caption ${LABEL_CLASS_NAMES[tone]}`}>{label}</Text>
    </Pressable>
  );
}

export type { TextActionButtonProps, TextActionButtonTone };
