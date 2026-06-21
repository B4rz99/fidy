import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { SolidSurface } from "./SolidSurface";

type SurfaceProps = ViewProps & {
  readonly backgroundColor?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly isInteractive?: boolean;
  readonly padded?: boolean;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
};

export function Surface(props: SurfaceProps) {
  return <SolidSurface {...props} />;
}

export type { SurfaceProps };
