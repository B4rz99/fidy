import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { SurfacePressable } from "./SurfacePressable";

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
  surface: "",
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
  const content = (
    <>
      {icon}
      {badgeLabel ? (
        <View className="-right-0.5 -top-0.5 absolute min-w-4 items-center justify-center rounded-full px-1">
          <Text className="font-poppins-bold text-[9px] text-danger">{badgeLabel}</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <SurfacePressable
      {...pressableProps}
      accessibilityRole={accessibilityRole ?? "button"}
      hitSlop={hitSlop}
      radius={999}
      padded={false}
      surfaceLayoutStyle={styles.surface}
      className={`relative ${size} items-center justify-center ${TONE_CLASS_NAMES[tone]} ${
        className ?? ""
      }`}
    >
      {content}
    </SurfacePressable>
  );
}

export type { IconActionButtonProps, IconActionButtonTone };

const styles = StyleSheet.create({
  surface: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
