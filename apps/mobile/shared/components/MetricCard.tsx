import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { Card } from "./Card";
import type { SurfaceLayoutStyle } from "./surface-style";

type MetricCardProps = Omit<ViewProps, "children" | "style"> & {
  readonly children: ReactNode;
  readonly onPress?: PressableProps["onPress"];
  readonly padded?: boolean;
  readonly contentClassName?: string;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly layoutStyle?: SurfaceLayoutStyle;
};

export function MetricCard({
  children,
  onPress,
  padded = true,
  contentClassName,
  contentStyle,
  layoutStyle,
  ...viewProps
}: MetricCardProps) {
  return (
    <Card
      {...viewProps}
      onPress={onPress}
      padded={padded}
      contentClassName={`gap-3 ${contentClassName ?? ""}`}
      contentStyle={contentStyle}
      layoutStyle={layoutStyle}
    >
      {children}
    </Card>
  );
}

export type { MetricCardProps };
