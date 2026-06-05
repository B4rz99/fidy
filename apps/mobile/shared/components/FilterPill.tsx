import type { ReactNode } from "react";
import type { PressableProps, ViewProps } from "react-native";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassSurface } from "./GlassSurface";

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
  const backgroundColor = selectedColor ?? primary;
  const content = (
    <>
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
    </>
  );

  return (
    <Pressable
      {...viewProps}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ ...viewProps.accessibilityState, selected }}
    >
      {selected ? (
        <View className={className} style={[styles.surface, style, { backgroundColor }]}>
          {content}
        </View>
      ) : (
        <GlassSurface
          className={className}
          padded={false}
          radius={999}
          style={[styles.surface, style]}
        >
          {content}
        </GlassSurface>
      )}
    </Pressable>
  );
}

export type { FilterPillProps };

const styles = StyleSheet.create({
  surface: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
  },
});
