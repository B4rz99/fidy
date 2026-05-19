import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type DialogRouteFrameProps = {
  readonly children: ReactNode;
};

export function DialogRouteFrame({ children }: DialogRouteFrameProps) {
  const router = useRouter();
  const card = useThemeColor("card");
  const modalBackdrop = useThemeColor("modalBackdrop");

  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.backdrop, { backgroundColor: `${modalBackdrop}66` }]}
      onPress={() => router.back()}
    >
      <View
        style={[styles.dialog, { backgroundColor: card }]}
        onStartShouldSetResponder={() => true}
      >
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "88%",
    borderRadius: 24,
    overflow: "hidden",
  },
});
