import type { ReactNode } from "react";
import type { PressableProps, StyleProp, TextStyle, ViewProps, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { SurfacePressable } from "./SurfacePressable";

type FilterPillProps = Omit<ViewProps, "children"> & {
  readonly label?: string;
  readonly leading?: ReactNode;
  readonly selected?: boolean;
  readonly dimmed?: boolean;
  readonly onPress: PressableProps["onPress"];
  readonly selectedColor?: string;
  readonly surfaceBackgroundColor?: string;
  readonly selectedBackgroundColor?: string;
  readonly selectedTextColor?: string;
  readonly className?: string;
  readonly labelStyle?: StyleProp<TextStyle>;
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
    flex: flattened.flex,
    flexBasis: flattened.flexBasis,
    flexGrow: flattened.flexGrow,
    flexShrink: flattened.flexShrink,
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
  dimmed = false,
  onPress,
  selectedColor,
  surfaceBackgroundColor,
  selectedBackgroundColor,
  selectedTextColor,
  className,
  labelStyle,
  labelClassName,
  style,
  ...viewProps
}: FilterPillProps) {
  const accentGreen = useThemeColor("accentGreen");
  const primary = useThemeColor("primary");
  const selectedText = selectedColor ?? accentGreen;
  const backgroundColor = selected
    ? (selectedBackgroundColor ?? surfaceBackgroundColor)
    : surfaceBackgroundColor;
  const pressableStyle = getPressableLayoutStyle(style);
  const surfaceStyle = getSurfaceStyle(style);
  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      {label ? (
        <Text
          className={`text-center font-poppins-medium text-caption ${labelClassName ?? ""}`}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[{ color: selected ? (selectedTextColor ?? selectedText) : primary }, labelStyle]}
        >
          {label}
        </Text>
      ) : null}
    </>
  );

  return (
    <SurfacePressable
      {...viewProps}
      onPress={onPress}
      accessibilityState={{ ...viewProps.accessibilityState, selected }}
      backgroundColor={backgroundColor}
      style={[pressableStyle, dimmed ? styles.dimmed : null]}
      radius={999}
      surfaceClassName={className}
      surfaceLayoutStyle={[styles.surface, surfaceStyle]}
    >
      {content}
    </SurfacePressable>
  );
}

export type { FilterPillProps };

const styles = StyleSheet.create({
  surface: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
    width: "100%",
  },
  dimmed: {
    opacity: 0.4,
  },
});
