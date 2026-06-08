import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ChevronLeft, X } from "@/shared/components/icons";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { AppAuroraBackground } from "./AppAuroraBackground";
import { GlassSurface } from "./GlassSurface";

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
  const isDark = useColorScheme() === "dark";
  const modalBackdrop = useThemeColor("modalBackdrop");
  const secondary = useThemeColor("secondary");
  const closeToOrigin = () => router.dismiss(closeDepth);

  return (
    <View style={styles.root}>
      <AppAuroraBackground isDark={isDark} />
      <Pressable
        accessibilityRole="button"
        style={[styles.backdrop, { backgroundColor: `${modalBackdrop}66` }]}
        onPress={closeToOrigin}
      >
        <GlassSurface
          padded={false}
          radius={24}
          style={styles.dialog}
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
        </GlassSurface>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
