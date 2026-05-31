import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { Card } from "./Card";

type MetricCardProps = Omit<ViewProps, "children" | "style"> & {
  readonly children: ReactNode;
  readonly onPress?: PressableProps["onPress"];
  readonly padded?: boolean;
  readonly contentClassName?: string;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly surfaceStyle?: StyleProp<ViewStyle>;
};

export function MetricCard({
  children,
  onPress,
  padded = true,
  contentClassName,
  contentStyle,
  surfaceStyle,
  ...viewProps
}: MetricCardProps) {
  return (
    <Card
      {...viewProps}
      onPress={onPress}
      padded={padded}
      contentClassName={`gap-3 ${contentClassName ?? ""}`}
      contentStyle={contentStyle}
      surfaceStyle={surfaceStyle}
    >
      {children}
    </Card>
  );
}

export type { MetricCardProps };
