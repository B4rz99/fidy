import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { GlassSurface } from "./GlassSurface";

type SurfaceProps = ViewProps & {
  readonly backgroundColor?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly isInteractive?: boolean;
  readonly nativeGlass?: boolean;
  readonly padded?: boolean;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
};

export function Surface(props: SurfaceProps) {
  return <GlassSurface {...props} />;
}

export type { SurfaceProps };
