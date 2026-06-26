import type { ReactNode } from "react";
import type {
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  ViewProps,
  ViewStyle,
} from "react-native";
import { RAISED_SURFACE_SHADOW } from "@/shared/components/effect-tokens";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type RaisedSurfaceProps = Omit<ViewProps, "style"> & {
  readonly children: ReactNode;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
};

type RaisedPressableProps = Omit<PressableProps, "children" | "style"> & {
  readonly children: ReactNode;
  readonly disabledOpacity?: number;
  readonly radius?: number;
  readonly style?: PressableProps["style"];
};

function getRaisedStyle(radius: number, backgroundColor: string, borderColor: string) {
  return [
    styles.raised,
    {
      backgroundColor,
      borderColor,
      borderRadius: radius,
    },
  ];
}

function getPressableStyle(
  baseStyle: readonly StyleProp<ViewStyle>[],
  disabled: boolean | null | undefined,
  disabledOpacity: number,
  style: PressableProps["style"]
) {
  const disabledStyle = disabled ? { opacity: disabledOpacity } : null;
  if (typeof style === "function") {
    return (state: PressableStateCallbackType) => [...baseStyle, disabledStyle, style(state)];
  }
  return [...baseStyle, disabledStyle, style];
}

export function RaisedSurface({ children, radius = 12, style, ...viewProps }: RaisedSurfaceProps) {
  const borderSubtle = useThemeColor("borderSubtle");
  const surfaceRaised = useThemeColor("surfaceRaised");

  return (
    <View {...viewProps} style={[...getRaisedStyle(radius, surfaceRaised, borderSubtle), style]}>
      {children}
    </View>
  );
}

export function RaisedPressable({
  children,
  disabled,
  disabledOpacity = 0.82,
  radius = 12,
  style,
  ...pressableProps
}: RaisedPressableProps) {
  const borderSubtle = useThemeColor("borderSubtle");
  const surfaceRaised = useThemeColor("surfaceRaised");
  const baseStyle = getRaisedStyle(radius, surfaceRaised, borderSubtle);

  return (
    <Pressable
      {...pressableProps}
      disabled={disabled}
      style={getPressableStyle(baseStyle, disabled, disabledOpacity, style)}
    >
      {children}
    </Pressable>
  );
}

export type { RaisedPressableProps, RaisedSurfaceProps };

const styles = StyleSheet.create({
  raised: {
    borderWidth: 1,
    borderCurve: "continuous",
    boxShadow: RAISED_SURFACE_SHADOW,
  },
});
