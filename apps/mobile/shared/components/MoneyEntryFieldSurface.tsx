import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { FieldSurface } from "./FieldSurface";

type MoneyEntryFieldSurfaceProps = {
  readonly children: ReactNode;
  readonly compact?: boolean;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
};

export function MoneyEntryFieldSurface({
  children,
  compact = false,
  radius = compact ? 10 : 14,
  style,
  testID,
}: MoneyEntryFieldSurfaceProps) {
  return (
    <FieldSurface
      testID={testID}
      size={compact ? "compact" : "regular"}
      radius={radius}
      style={style}
      contentStyle={compact ? undefined : { flex: 1 }}
    >
      {children}
    </FieldSurface>
  );
}

export type { MoneyEntryFieldSurfaceProps };
