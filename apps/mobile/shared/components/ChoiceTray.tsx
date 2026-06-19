import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "@/shared/components/rn";

type ChoiceTrayProps = {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
};

export function ChoiceTray({ children, style }: ChoiceTrayProps) {
  return <View style={[styles.tray, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    overflow: "visible",
    paddingVertical: 2,
  },
});
