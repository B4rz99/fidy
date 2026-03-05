import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  onClose: () => void;
  children: ReactNode;
};

export function PopupOverlay({ onClose, children }: Props) {
  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000025",
    justifyContent: "center",
    alignItems: "center",
  },
});
