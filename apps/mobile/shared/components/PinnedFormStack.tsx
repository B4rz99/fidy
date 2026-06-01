import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "@/shared/components/rn";

type PinnedFormStackProps = {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
};

export function PinnedFormStack({ children, style }: PinnedFormStackProps) {
  return <View style={[styles.stack, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
});
