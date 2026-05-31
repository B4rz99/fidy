import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type FilterPillProps = Omit<ViewProps, "children"> & {
  readonly label?: string;
  readonly leading?: ReactNode;
  readonly selected?: boolean;
  readonly onPress: PressableProps["onPress"];
  readonly selectedColor?: string;
  readonly selectedTextColor?: string;
  readonly className?: string;
  readonly labelClassName?: string;
};

export function FilterPill({
  label,
  leading,
  selected = false,
  onPress,
  selectedColor,
  selectedTextColor = "#FFFFFF",
  className,
  labelClassName,
  style,
  ...viewProps
}: FilterPillProps) {
  const primary = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");
  const backgroundColor = selected ? (selectedColor ?? primary) : peachLight;

  return (
    <Pressable
      {...viewProps}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ ...viewProps.accessibilityState, selected }}
      className={`items-center justify-center rounded-full px-3 ${className ?? ""}`}
      style={[{ backgroundColor }, style]}
    >
      {leading ? <View>{leading}</View> : null}
      {label ? (
        <Text
          className={`text-center font-poppins-medium text-caption ${labelClassName ?? ""}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={{ color: selected ? selectedTextColor : primary }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export type { FilterPillProps };
