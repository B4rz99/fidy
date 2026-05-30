import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { Pressable, Text, View } from "@/shared/components/rn";

type IconActionButtonTone = "plain" | "surface";

type IconActionButtonProps = Omit<PressableProps, "children"> & {
  readonly icon: ReactNode;
  readonly badgeLabel?: string;
  readonly tone?: IconActionButtonTone;
  readonly size?: string;
  readonly className?: string;
};

const TONE_CLASS_NAMES: Record<IconActionButtonTone, string> = {
  plain: "bg-transparent",
  surface: "bg-surface dark:bg-surface-dark",
};

export function IconActionButton({
  icon,
  badgeLabel,
  tone = "plain",
  size = "size-10",
  className,
  accessibilityRole,
  hitSlop = 12,
  ...pressableProps
}: IconActionButtonProps) {
  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={accessibilityRole ?? "button"}
      hitSlop={hitSlop}
      className={`relative ${size} items-center justify-center rounded-full ${TONE_CLASS_NAMES[tone]} ${
        className ?? ""
      }`}
    >
      {icon}
      {badgeLabel ? (
        <View className="-right-0.5 -top-0.5 absolute min-w-4 items-center justify-center rounded-full bg-danger px-1">
          <Text className="font-poppins-bold text-[9px] text-white">{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export type { IconActionButtonProps, IconActionButtonTone };
