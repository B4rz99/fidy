import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
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

function getPressableLayoutStyle(style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return null;

  return {
    alignSelf: flattened.alignSelf,
    flex: flattened.flex,
    flexBasis: flattened.flexBasis,
    flexGrow: flattened.flexGrow,
    flexShrink: flattened.flexShrink,
    margin: flattened.margin,
    marginBottom: flattened.marginBottom,
    marginHorizontal: flattened.marginHorizontal,
    marginLeft: flattened.marginLeft,
    marginRight: flattened.marginRight,
    marginTop: flattened.marginTop,
    marginVertical: flattened.marginVertical,
  };
}

function getSurfaceStyle(style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return null;

  return {
    height: flattened.height,
    minHeight: flattened.minHeight,
    padding: flattened.padding,
    paddingBottom: flattened.paddingBottom,
    paddingHorizontal: flattened.paddingHorizontal,
    paddingLeft: flattened.paddingLeft,
    paddingRight: flattened.paddingRight,
    paddingTop: flattened.paddingTop,
    paddingVertical: flattened.paddingVertical,
    width: flattened.width,
  };
}

export function FilterPill({
  label,
  leading,
  selected = false,
  onPress,
  selectedColor,
  selectedTextColor,
  className,
  labelClassName,
  style,
  ...viewProps
}: FilterPillProps) {
  const primary = useThemeColor("primary");
  const selectedBorderColor = selectedColor ?? primary;
  const pressableStyle = getPressableLayoutStyle(style);
  const surfaceStyle = getSurfaceStyle(style);
  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      {label ? (
        <Text
          className={`text-center font-poppins-medium text-caption ${labelClassName ?? ""}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={{ color: selected ? (selectedTextColor ?? selectedBorderColor) : primary }}
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
      style={pressableStyle}
    >
      <GlassSurface
        className={className}
        nativeGlass={false}
        padded={false}
        radius={999}
        borderColor={selected ? selectedBorderColor : undefined}
        borderWidth={selected ? 1.5 : undefined}
        style={[styles.surface, surfaceStyle]}
      >
        {content}
      </GlassSurface>
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
