import { useState } from "react";
import type { ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, TriangleAlert } from "@/shared/components/icons";
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from "@/shared/components/rn";
import { useSubscription, useThemeColor } from "@/shared/hooks";
import { subscribeAppToasts } from "@/shared/lib";
import { TOAST_SURFACE_SHADOW } from "./effect-tokens";
import { SolidSurface } from "./SolidSurface";

type AppToast = Parameters<Parameters<typeof subscribeAppToasts>[0]>[0];
const LEGACY_ANDROID_SHADOW_PROPERTY = "elevation";

function getAndroidToastShadowFallback(): ViewStyle | null {
  if (Platform.OS !== "android") return null;

  return { [LEGACY_ANDROID_SHADOW_PROPERTY]: 8 } as ViewStyle;
}

export function AppToastHost() {
  const [toast, setToast] = useState<AppToast | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-80);
  const { top } = useSafeAreaInsets();
  const primary = useThemeColor("primary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const accent = toast?.kind === "error" ? accentRed : accentGreen;
  const ToastIcon = toast?.kind === "error" ? TriangleAlert : CheckCircle;
  const animatedToastStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useSubscription(() => subscribeAppToasts(setToast), []);
  useSubscription(
    () => {
      if (!toast) return;
      AccessibilityInfo.announceForAccessibility(toast.message);
      opacity.value = 0;
      translateY.value = -80;
      opacity.value = withTiming(1, { duration: 140 });
      translateY.value = withTiming(0, { duration: 220 });

      const exitTimer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 140 });
        translateY.value = withTiming(-80, { duration: 180 });
      }, toast.duration * 1000);
      const clearTimer = setTimeout(() => setToast(null), toast.duration * 1000 + 190);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(clearTimer);
      };
    },
    [toast?.duration, toast?.id],
    toast != null
  );

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toastPosition,
          {
            top: top + 12,
          },
          getAndroidToastShadowFallback(),
          animatedToastStyle,
        ]}
        accessibilityLiveRegion="polite"
      >
        <SolidSurface padded={false} radius={18} style={styles.toast}>
          <Text style={[styles.message, { color: primary }]} numberOfLines={2}>
            {toast.message}
          </Text>
          <View style={styles.icon}>
            <ToastIcon size={16} color={accent} strokeWidth={2.5} />
          </View>
        </SolidSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  message: {
    flex: 1,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  toast: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastPosition: {
    alignSelf: "center",
    boxShadow: TOAST_SURFACE_SHADOW,
    maxWidth: 360,
    minHeight: 52,
    position: "absolute",
    width: "88%",
  },
});
