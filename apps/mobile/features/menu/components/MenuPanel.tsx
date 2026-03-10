import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useMenuStore } from "../store";

const PANEL_WIDTH = 200;
// Distance from bottom of screen to clear the tab bar
const TAB_BAR_CLEARANCE = 100;

export function MenuPanel() {
  const isOpen = useMenuStore((s) => s.isOpen);
  const closeMenu = useMenuStore((s) => s.closeMenu);
  const { push } = useRouter();
  const insets = useSafeAreaInsets();

  const panelBg = useThemeColor("nav");
  const itemBg = useThemeColor("peachLight");
  const primaryColor = useThemeColor("primary");

  const isOpenAnimated = useSharedValue(0);

  useEffect(() => {
    isOpenAnimated.set(withTiming(isOpen ? 1 : 0, { duration: 300 }));
  }, [isOpen, isOpenAnimated]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: isOpenAnimated.get(),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(isOpenAnimated.get(), [0, 1], [PANEL_WIDTH + 32, 0]) }],
    opacity: isOpenAnimated.get(),
  }));

  const handleConnectedAccounts = () => {
    closeMenu();
    push("/connected-accounts" as never);
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
        <Pressable
          style={[styles.menuItem, { backgroundColor: itemBg }]}
          onPress={handleConnectedAccounts}
        >
          <Mail size={20} color={primaryColor} />
          <Text style={[styles.menuItemText, { color: primaryColor }]}>Connected Mails</Text>
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
    borderCurve: "continuous",
    padding: 12,
    gap: 8,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
});
