import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { MoneyAmountDisplay, type MoneyAmountDisplayProps } from "./MoneyAmountDisplay";

type MoneyEntryAmountFieldProps = Omit<MoneyAmountDisplayProps, "color"> & {
  readonly color?: string;
  readonly helper?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
};

export function MoneyEntryAmountField({
  color,
  helper,
  style,
  size = "hero",
  ...amountProps
}: MoneyEntryAmountFieldProps) {
  const primary = useThemeColor("primary");

  return (
    <View style={[styles.container, style]}>
      <MoneyAmountDisplay color={color ?? primary} size={size} {...amountProps} />
      {helper}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
});

export type { MoneyEntryAmountFieldProps };
