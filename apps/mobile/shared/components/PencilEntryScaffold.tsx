import type { ReactNode } from "react";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAuroraBackground } from "@/shared/components/AppAuroraBackground";
import { Check, Delete } from "@/shared/components/icons";
import {
  Keyboard,
  Platform,
  Pressable,
  type StyleProp,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "@/shared/components/rn";
import { useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./PencilEntryScaffold.styles";
export { PencilEntryField, PencilEntryTextInputField } from "./PencilEntryField";
export type { PencilEntryFieldProps } from "./PencilEntryField";

export type PencilEntryTab = "expense" | "income" | "transfer";

type PencilEntryScaffoldProps = {
  readonly activeTab: PencilEntryTab;
  readonly amount: string;
  readonly fields: ReactNode;
  readonly isConfirmDisabled: boolean;
  readonly onConfirm: () => void;
  readonly onKeyPress: (key: string) => void;
  readonly onTabPress: (tab: PencilEntryTab) => void;
  readonly tabs: readonly { readonly key: PencilEntryTab; readonly label: string }[];
  readonly includesNativeHeader?: boolean;
};

export const PENCIL_ENTRY_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["000", "0", "delete"],
] as const;

const ANDROID_TAB_BAR_HEIGHT = 64;
const PENCIL_ENTRY_HORIZONTAL_PADDING = 16;
const SWIPE_TAB_THRESHOLD = 56;
const TAB_GAP = 8;
const NUMPAD_RIPPLE_COLOR = "rgba(255, 255, 255, 0.42)";

function getTabIndicatorColor(input: {
  readonly accentGreen: string;
  readonly accentRed: string;
  readonly tab: PencilEntryTab;
  readonly tertiary: string;
}) {
  if (input.tab === "expense") return input.accentRed;
  if (input.tab === "income") return input.accentGreen;
  return input.tertiary;
}

type PencilNumpadButtonProps = {
  readonly accessibilityLabel?: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
  readonly style: StyleProp<ViewStyle>;
  readonly testID?: string;
};

function PencilNumpadButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
  style,
  testID,
}: PencilNumpadButtonProps) {
  const feedback = useSharedValue(0);
  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedback.value,
    transform: [{ scale: 0.88 + feedback.value * 0.12 }],
  }));
  const showFeedback = () => {
    if (disabled) return;
    feedback.value = withTiming(1, { duration: 80 });
  };
  const hideFeedback = () => {
    feedback.value = withTiming(0, { duration: 180 });
  };

  return (
    <Pressable
      testID={testID}
      style={style}
      android_ripple={{ color: NUMPAD_RIPPLE_COLOR, borderless: false }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={showFeedback}
      onPressOut={hideFeedback}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View pointerEvents="none" style={[styles.keyFeedback, feedbackStyle]} />
      {children}
    </Pressable>
  );
}

export function PencilEntryScaffold({
  activeTab,
  amount,
  fields,
  isConfirmDisabled,
  onConfirm,
  onKeyPress,
  onTabPress,
  tabs,
  includesNativeHeader = false,
}: PencilEntryScaffoldProps) {
  const { width } = useWindowDimensions();
  const tabBarWidth = useSharedValue(Math.max(width - PENCIL_ENTRY_HORIZONTAL_PADDING * 2, 0));
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const accentRed = useThemeColor("accentRed");
  const keyBg = useThemeColor("numpadKey");
  const specialKeyBg = useThemeColor("numpadSpecialKey");
  const activeColor = getTabIndicatorColor({ accentGreen, accentRed, tab: activeTab, tertiary });
  const { bottom, top } = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "ios" ? ANDROID_TAB_BAR_HEIGHT / 8 : ANDROID_TAB_BAR_HEIGHT;
  const tabBarClearance = tabBarHeight + Math.max(bottom, 16);
  const activeTabIndex = tabs.findIndex((tab) => tab.key === activeTab);
  const totalTabGap = Math.max(tabs.length - 1, 0) * TAB_GAP;
  const tabPillWidth = Math.max(
    (width - PENCIL_ENTRY_HORIZONTAL_PADDING * 2 - totalTabGap) / Math.max(tabs.length, 1),
    0
  );
  const animatedTabPillX = useDerivedValue(() => {
    const tabWidth = tabs.length > 0 ? (tabBarWidth.value - totalTabGap) / tabs.length : 0;
    const translateX = activeTabIndex < 0 ? 0 : activeTabIndex * (tabWidth + TAB_GAP);

    return withTiming(translateX, { duration: 180 });
  });
  const animatedTabPillColor = useDerivedValue(() => withTiming(activeColor, { duration: 180 }));
  const animatedTabPillStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: animatedTabPillColor.value,
      transform: [{ translateX: animatedTabPillX.value }],
    };
  });
  const handleKeyPress = (key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onKeyPress(key);
  };
  const handleConfirmPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onConfirm();
  };
  const tabSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-16, 16])
    .failOffsetY([-24, 24])
    .onEnd((event) => {
      if (activeTabIndex < 0) return;
      if (event.translationX <= -SWIPE_TAB_THRESHOLD) {
        const nextTab = tabs[Math.min(activeTabIndex + 1, tabs.length - 1)];
        if (nextTab && nextTab.key !== activeTab) onTabPress(nextTab.key);
        return;
      }
      if (event.translationX >= SWIPE_TAB_THRESHOLD) {
        const previousTab = tabs[Math.max(activeTabIndex - 1, 0)];
        if (previousTab && previousTab.key !== activeTab) onTabPress(previousTab.key);
      }
    });

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: tabBarClearance,
          paddingTop: includesNativeHeader ? 16 : top + 16,
        },
      ]}
    >
      <AppAuroraBackground isDark={isDark} />
      <View
        style={styles.tabs}
        onLayout={(event) => {
          tabBarWidth.value = event.nativeEvent.layout.width;
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabPress(tab.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  { color: isActive ? onAccent : tertiary, fontWeight: isActive ? "700" : "600" },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        <Animated.View style={[styles.tabPill, { width: tabPillWidth }, animatedTabPillStyle]} />
      </View>

      <GestureDetector gesture={tabSwipe}>
        <View style={styles.swipeArea}>
          <Pressable style={styles.amountArea} onPress={Keyboard.dismiss}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.35}
              style={[styles.amount, { color: primary }]}
            >
              {amount || "$0"}
            </Text>
          </Pressable>

          <View style={styles.fields}>{fields}</View>

          <View style={styles.numpad}>
            {PENCIL_ENTRY_ROWS.map((row) => (
              <View key={row.join("-")} style={styles.numpadRow}>
                {row.map((key) => {
                  if (key === "delete") {
                    return (
                      <View key={key} style={styles.rightColumn}>
                        <PencilNumpadButton
                          style={[styles.key, { backgroundColor: specialKeyBg }]}
                          onPress={() => handleKeyPress(key)}
                          accessibilityLabel={t("common.delete")}
                        >
                          <Delete size={20} color={tertiary} />
                        </PencilNumpadButton>
                        <PencilNumpadButton
                          testID="keyConfirm"
                          style={[
                            styles.key,
                            {
                              backgroundColor: accentGreen,
                              opacity: isConfirmDisabled ? 0.45 : 1,
                            },
                          ]}
                          disabled={isConfirmDisabled}
                          onPress={isConfirmDisabled ? undefined : handleConfirmPress}
                        >
                          <Check size={22} color={onAccent} />
                        </PencilNumpadButton>
                      </View>
                    );
                  }

                  return (
                    <PencilNumpadButton
                      key={key}
                      style={[styles.key, { backgroundColor: keyBg }]}
                      onPress={() => handleKeyPress(key)}
                      accessibilityLabel={key}
                    >
                      <Text style={[styles.keyText, { color: primary }]}>{key}</Text>
                    </PencilNumpadButton>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
