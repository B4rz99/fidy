import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "@/shared/components/rn";

type SurfaceLayoutViewStyle = Pick<
  ViewStyle,
  | "alignContent"
  | "alignItems"
  | "alignSelf"
  | "aspectRatio"
  | "bottom"
  | "columnGap"
  | "display"
  | "end"
  | "flex"
  | "flexBasis"
  | "flexDirection"
  | "flexGrow"
  | "flexShrink"
  | "flexWrap"
  | "gap"
  | "height"
  | "justifyContent"
  | "left"
  | "margin"
  | "marginBottom"
  | "marginEnd"
  | "marginHorizontal"
  | "marginLeft"
  | "marginRight"
  | "marginStart"
  | "marginTop"
  | "marginVertical"
  | "maxHeight"
  | "maxWidth"
  | "minHeight"
  | "minWidth"
  | "padding"
  | "paddingBottom"
  | "paddingEnd"
  | "paddingHorizontal"
  | "paddingLeft"
  | "paddingRight"
  | "paddingStart"
  | "paddingTop"
  | "paddingVertical"
  | "position"
  | "right"
  | "rowGap"
  | "start"
  | "top"
  | "width"
  | "zIndex"
>;

export type SurfaceLayoutStyle = StyleProp<SurfaceLayoutViewStyle>;

export function getSurfaceLayoutStyle(style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return null;

  const {
    backgroundColor: _backgroundColor,
    borderBlockColor: _borderBlockColor,
    borderBlockEndColor: _borderBlockEndColor,
    borderBlockStartColor: _borderBlockStartColor,
    borderBottomColor: _borderBottomColor,
    borderBottomEndRadius: _borderBottomEndRadius,
    borderBottomLeftRadius: _borderBottomLeftRadius,
    borderBottomRightRadius: _borderBottomRightRadius,
    borderBottomStartRadius: _borderBottomStartRadius,
    borderBottomWidth: _borderBottomWidth,
    borderColor: _borderColor,
    borderCurve: _borderCurve,
    borderEndColor: _borderEndColor,
    borderEndWidth: _borderEndWidth,
    borderLeftColor: _borderLeftColor,
    borderLeftWidth: _borderLeftWidth,
    borderRadius: _borderRadius,
    borderRightColor: _borderRightColor,
    borderRightWidth: _borderRightWidth,
    borderStartColor: _borderStartColor,
    borderStartWidth: _borderStartWidth,
    borderStyle: _borderStyle,
    borderTopColor: _borderTopColor,
    borderTopEndRadius: _borderTopEndRadius,
    borderTopLeftRadius: _borderTopLeftRadius,
    borderTopRightRadius: _borderTopRightRadius,
    borderTopStartRadius: _borderTopStartRadius,
    borderTopWidth: _borderTopWidth,
    borderWidth: _borderWidth,
    opacity: _opacity,
    overflow: _overflow,
    ...layoutStyle
  } = flattened;

  return layoutStyle;
}
