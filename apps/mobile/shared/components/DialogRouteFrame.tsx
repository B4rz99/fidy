import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ChevronLeft, X } from "@/shared/components/icons";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type DialogRouteFrameProps = {
  readonly children: ReactNode;
  readonly closeDepth?: number;
  readonly showBack?: boolean;
};

export function DialogRouteFrame({
  children,
  closeDepth = 1,
  showBack = false,
}: DialogRouteFrameProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const modalBackdrop = useThemeColor("modalBackdrop");
  const secondary = useThemeColor("secondary");
  const closeToOrigin = () => router.dismiss(closeDepth);

  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.backdrop, { backgroundColor: `${modalBackdrop}66` }]}
      onPress={closeToOrigin}
    >
      <View
        style={[styles.dialog, { backgroundColor: card }]}
        onStartShouldSetResponder={() => true}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <View style={styles.header}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
              hitSlop={12}
              style={styles.headerButton}
              onPress={() => router.dismiss()}
            >
              <ChevronLeft size={24} color={secondary} />
            </Pressable>
          ) : (
            <View style={styles.headerButton} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={12}
            style={styles.headerButton}
            onPress={closeToOrigin}
          >
            <X size={22} color={secondary} />
          </Pressable>
        </View>
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    height: 48,
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
