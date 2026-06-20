import type { StyleProp, TextStyle, ViewStyle } from "@/shared/components/rn";
import { StyleSheet } from "@/shared/components/rn";

export function getFieldContainerStyle(inputStyle: StyleProp<TextStyle>): StyleProp<ViewStyle> {
  if (inputStyle == null) return null;
  const flattened = StyleSheet.flatten(inputStyle);

  return {
    alignSelf: flattened.alignSelf,
    flex: flattened.flex,
    flexBasis: flattened.flexBasis,
    flexGrow: flattened.flexGrow,
    flexShrink: flattened.flexShrink,
    height: flattened.height,
    maxWidth: flattened.maxWidth,
    minHeight: flattened.minHeight,
    minWidth: flattened.minWidth,
    width: flattened.width,
  };
}

export function getFieldContentStyle(inputStyle: StyleProp<TextStyle>): StyleProp<ViewStyle> {
  if (inputStyle == null) return null;
  const flattened = StyleSheet.flatten(inputStyle);

  return {
    height: flattened.height,
    minHeight: flattened.minHeight ?? flattened.height,
    padding: flattened.padding,
    paddingBottom: flattened.paddingBottom,
    paddingEnd: flattened.paddingEnd,
    paddingHorizontal: flattened.paddingHorizontal,
    paddingLeft: flattened.paddingLeft,
    paddingRight: flattened.paddingRight,
    paddingStart: flattened.paddingStart,
    paddingTop: flattened.paddingTop,
    paddingVertical: flattened.paddingVertical,
  };
}

export function getTextInputSizingStyle(inputStyle: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (inputStyle == null) return null;
  const flattened = StyleSheet.flatten(inputStyle);
  if (!flattened.height) return null;

  return {
    minHeight: flattened.height,
  };
}

export function getTextInputContentStyle(inputStyle: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (inputStyle == null) return null;
  const flattened = StyleSheet.flatten(inputStyle);

  const {
    padding: _padding,
    paddingBottom: _paddingBottom,
    paddingEnd: _paddingEnd,
    paddingHorizontal: _paddingHorizontal,
    paddingLeft: _paddingLeft,
    paddingRight: _paddingRight,
    paddingStart: _paddingStart,
    paddingTop: _paddingTop,
    paddingVertical: _paddingVertical,
    ...textInputStyle
  } = flattened;

  return textInputStyle;
}
