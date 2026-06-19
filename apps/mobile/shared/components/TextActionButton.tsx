import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { Text } from "@/shared/components/rn";
import { GlassPressable } from "./GlassPressable";

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
  return (
    <GlassPressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      padded={false}
      radius={appearance === "pill" ? 999 : 10}
      className={`${className ?? ""}`}
      surfaceLayoutStyle={{
        alignItems: "center",
        flexDirection: "row",
        gap: 4,
        justifyContent: "center",
        minHeight: appearance === "pill" ? 32 : undefined,
        paddingHorizontal: appearance === "pill" ? 8 : 4,
      }}
    >
      {icon}
      <Text className={`font-poppins-medium text-caption ${LABEL_CLASS_NAMES[tone]}`}>{label}</Text>
    </GlassPressable>
  );
}

export type { TextActionButtonProps, TextActionButtonTone };
