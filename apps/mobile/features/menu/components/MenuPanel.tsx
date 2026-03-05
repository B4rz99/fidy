import { useRouter } from "expo-router";
import { Calendar } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useMenuStore } from "../store";

const PANEL_WIDTH = 200;
// Distance from bottom of screen to clear the tab bar
const TAB_BAR_CLEARANCE = 100;

export function MenuPanel() {
  const isOpen = useMenuStore((s) => s.isOpen);
  const closeMenu = useMenuStore((s) => s.closeMenu);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const panelBg = useThemeColor("nav");
  const itemBg = useThemeColor("peachLight");
  const primaryColor = useThemeColor("primary");

  const backdropOpacity = useSharedValue(0);
  const translateX = useSharedValue(PANEL_WIDTH + 32);
  const panelOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateX.value = withTiming(0, { duration: 300 });
      panelOpacity.value = withTiming(1, { duration: 300 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateX.value = withTiming(PANEL_WIDTH + 32, { duration: 250 });
      panelOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOpen, backdropOpacity, translateX, panelOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: panelOpacity.value,
  }));

  const handleCalendar = () => {
    closeMenu();
    router.push("/(tabs)/calendar");
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? "auto" : "none"}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: panelBg,
            bottom: TAB_BAR_CLEARANCE + insets.bottom,
          },
          panelStyle,
        ]}
      >
        <Pressable style={[styles.menuItem, { backgroundColor: itemBg }]} onPress={handleCalendar}>
          <Calendar size={20} color={primaryColor} />
          <Text style={[styles.menuItemText, { color: primaryColor }]}>Calendar</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000040",
  },
  panel: {
    position: "absolute",
    right: 16,
    width: PANEL_WIDTH,
    borderRadius: 20,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
});
