import type { ReactNode } from "react";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAuroraBackground } from "@/shared/components/AppAuroraBackground";
import { Check, Delete } from "@/shared/components/icons";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "@/shared/components/rn";
import { useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./EntryScaffold.styles";
import { NUMPAD_SURFACE_RIPPLE_COLOR } from "./effect-tokens";
import { SurfacePressable } from "./SurfacePressable";
import { SegmentedControl } from "./SegmentedControl";
import { useNumpadSurfaceStyles } from "./use-numpad-surface-styles";
export { EntryField, EntryTextInputField } from "./EntryField";
export type { EntryFieldProps } from "./EntryField";

export type EntryTab = "expense" | "income" | "transfer";

type EntryScaffoldProps = {
  readonly activeTab: EntryTab;
  readonly amount: string;
  readonly fields: ReactNode;
  readonly isConfirmDisabled: boolean;
  readonly onConfirm: () => void;
  readonly onKeyPress: (key: string) => void;
  readonly onTabPress: (tab: EntryTab) => void;
  readonly tabs: readonly { readonly key: EntryTab; readonly label: string }[];
  readonly includesNativeHeader?: boolean;
};

const ENTRY_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["000", "0", "delete"],
] as const;

const ANDROID_TAB_BAR_HEIGHT = 64;
const SWIPE_TAB_THRESHOLD = 56;

type EntryNumpadButtonProps = {
  readonly accessibilityLabel?: string;
  readonly backgroundColor?: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly disabledOpacity?: number;
  readonly onPress?: () => void;
  readonly style: StyleProp<ViewStyle>;
  readonly testID?: string;
};

function EntryNumpadButton({
  accessibilityLabel,
  backgroundColor,
  children,
  disabled = false,
  disabledOpacity = 0.45,
  onPress,
  style,
  testID,
}: EntryNumpadButtonProps) {
  const flattenedStyle = StyleSheet.flatten(style);
  const radius =
    typeof flattenedStyle?.borderRadius === "number" ? flattenedStyle.borderRadius : 14;
  const layoutStyle = {
    alignItems: flattenedStyle?.alignItems,
    flex: flattenedStyle?.flex,
    justifyContent: flattenedStyle?.justifyContent,
    position: "relative" as const,
  };
  const surfaceLayoutStyle = [
    StyleSheet.absoluteFillObject,
    {
      alignItems: flattenedStyle?.alignItems,
      justifyContent: flattenedStyle?.justifyContent,
    },
  ];

  return (
    <SurfacePressable
      testID={testID}
      backgroundColor={backgroundColor}
      style={layoutStyle}
      surfaceLayoutStyle={surfaceLayoutStyle}
      radius={radius}
      padded={false}
      isInteractive
      disabledOpacity={disabledOpacity}
      android_ripple={{ color: NUMPAD_SURFACE_RIPPLE_COLOR, borderless: false }}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </SurfacePressable>
  );
}

export function EntryScaffold({
  activeTab,
  amount,
  fields,
  isConfirmDisabled,
  onConfirm,
  onKeyPress,
  onTabPress,
  tabs,
  includesNativeHeader = false,
}: EntryScaffoldProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const { keySurfaceStyle, specialKeySurfaceStyle } = useNumpadSurfaceStyles();
  const { bottom, top } = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "ios" ? ANDROID_TAB_BAR_HEIGHT / 8 : ANDROID_TAB_BAR_HEIGHT;
  const tabBarClearance = tabBarHeight + Math.max(bottom, 16);
  const activeTabIndex = tabs.findIndex((tab) => tab.key === activeTab);
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
      <SegmentedControl
        options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
        value={activeTab}
        onChange={onTabPress}
        variant="detached"
        style={styles.tabs}
      />

      <GestureDetector gesture={tabSwipe}>
        <View style={styles.swipeArea}>
          <Pressable style={styles.amountArea} onPress={Keyboard.dismiss}>
            <View
              style={[
                styles.amountBanner,
                {
                  backgroundColor: "transparent",
                  borderColor: "transparent",
                },
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.35}
                style={[styles.amount, { color: primary }]}
              >
                {amount || "$0"}
              </Text>
            </View>
          </Pressable>

          <View style={styles.fields}>{fields}</View>

          <View style={styles.numpad}>
            {ENTRY_ROWS.map((row) => (
              <View key={row.join("-")} style={styles.numpadRow}>
                {row.map((key) => {
                  if (key === "delete") {
                    return (
                      <View key={key} style={styles.rightColumn}>
                        <EntryNumpadButton
                          style={[styles.key, specialKeySurfaceStyle]}
                          onPress={() => handleKeyPress(key)}
                          accessibilityLabel={t("common.delete")}
                        >
                          <Delete size={20} color={tertiary} />
                        </EntryNumpadButton>
                        <EntryNumpadButton
                          testID="keyConfirm"
                          style={[styles.key, specialKeySurfaceStyle]}
                          backgroundColor={accentGreen}
                          disabled={isConfirmDisabled}
                          disabledOpacity={1}
                          onPress={isConfirmDisabled ? undefined : handleConfirmPress}
                          accessibilityLabel={t("common.confirm")}
                        >
                          <Check size={22} color={isConfirmDisabled ? tertiary : onAccent} />
                        </EntryNumpadButton>
                      </View>
                    );
                  }

                  return (
                    <EntryNumpadButton
                      key={key}
                      style={[styles.key, keySurfaceStyle]}
                      onPress={() => handleKeyPress(key)}
                      accessibilityLabel={key}
                    >
                      <Text style={[styles.keyText, { color: primary }]}>{key}</Text>
                    </EntryNumpadButton>
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
