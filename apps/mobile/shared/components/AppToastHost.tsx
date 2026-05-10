import { useState } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle } from "@/shared/components/icons";
import { AccessibilityInfo, StyleSheet, Text, View } from "@/shared/components/rn";
import { useSubscription, useThemeColor } from "@/shared/hooks";
import { subscribeAppToasts } from "@/shared/lib";

type AppToast = Parameters<Parameters<typeof subscribeAppToasts>[0]>[0];

export function AppToastHost() {
  const [toast, setToast] = useState<AppToast | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-80);
  const { top } = useSafeAreaInsets();
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
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
          styles.toast,
          {
            top: top + 12,
            backgroundColor: card,
            borderColor: accentGreen,
            shadowColor: primary,
          },
          animatedToastStyle,
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.message, { color: primary }]} numberOfLines={2}>
          {toast.message}
        </Text>
        <View style={[styles.icon, { backgroundColor: accentGreen }]}>
          <CheckCircle size={16} color={onAccent} strokeWidth={2.5} />
        </View>
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
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 8,
    flexDirection: "row",
    gap: 12,
    maxWidth: 360,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: "absolute",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    width: "88%",
  },
});
