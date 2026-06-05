import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "@/shared/components/rn";
import { GlassSurface } from "./GlassSurface";

type FieldSurfaceSize = "regular" | "compact" | "button";

type FieldSurfaceProps = {
  readonly children: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly radius?: number;
  readonly size?: FieldSurfaceSize;
  readonly style?: StyleProp<ViewStyle>;
  readonly surfaceStyle?: StyleProp<ViewStyle>;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
};

const FIELD_SURFACE_DEFAULTS: Record<
  FieldSurfaceSize,
  { readonly height: number; readonly paddingHorizontal: number; readonly radius: number }
> = {
  regular: { height: 50, paddingHorizontal: 14, radius: 14 },
  compact: { height: 44, paddingHorizontal: 14, radius: 10 },
  button: { height: 40, paddingHorizontal: 12, radius: 8 },
};

export function FieldSurface({
  children,
  contentStyle,
  radius,
  size = "regular",
  style,
  surfaceStyle,
  testID,
}: FieldSurfaceProps) {
  const defaults = FIELD_SURFACE_DEFAULTS[size];

  return (
    <View
      testID={testID}
      style={[
        styles.shell,
        {
          minHeight: defaults.height,
        },
        style,
      ]}
    >
      <GlassSurface
        nativeGlass={false}
        pointerEvents="none"
        padded={false}
        radius={radius ?? defaults.radius}
        style={[StyleSheet.absoluteFillObject, styles.surface, surfaceStyle]}
      >
        <View />
      </GlassSurface>
      <View
        style={[
          styles.content,
          {
            minHeight: defaults.height,
            paddingHorizontal: defaults.paddingHorizontal,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    position: "relative",
  },
  surface: {
    backgroundColor: "transparent",
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
});

export type { FieldSurfaceProps, FieldSurfaceSize };
