import type { ComponentType, ReactNode } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Delete } from "@/shared/components/icons";
import { Platform, Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./PencilEntryScaffold.styles";

export type PencilEntryTab = "expense" | "income" | "transfer";

export type PencilEntryFieldProps = {
  readonly icon: ComponentType<{ size?: number; color?: string }>;
  readonly label: string;
  readonly value?: string;
  readonly valueTone?: "primary" | "secondary" | "tertiary";
  readonly onPress?: () => void;
  readonly children?: ReactNode;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
};

type PencilEntryScaffoldProps = {
  readonly activeTab: PencilEntryTab;
  readonly amount: string;
  readonly fields: ReactNode;
  readonly isConfirmDisabled: boolean;
  readonly onConfirm: () => void;
  readonly onKeyPress: (key: string) => void;
  readonly onTabPress: (tab: PencilEntryTab) => void;
  readonly tabs: readonly { readonly key: PencilEntryTab; readonly label: string }[];
};

export const PENCIL_ENTRY_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["000", "0", "delete"],
] as const;

const ANDROID_TAB_BAR_HEIGHT = 64;
const SWIPE_TAB_THRESHOLD = 56;
const TAB_LINE_WIDTH = 88;

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

export function PencilEntryField({
  children,
  icon: Icon,
  label,
  onPress,
  testID,
  value,
  valueTone,
}: PencilEntryFieldProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");
  const card = useThemeColor("card");
  const toneColor =
    valueTone === "primary"
      ? primary
      : valueTone === "secondary"
        ? secondary
        : valueTone === "tertiary"
          ? tertiary
          : value
            ? primary
            : tertiary;
  const content = children ?? (
    <Text
      numberOfLines={1}
      style={[styles.fieldText, { color: toneColor }]}
    >{`${label}${value ? ` ${value}` : ""}`}</Text>
  );

  const fieldStyle = [styles.fieldCard, { backgroundColor: card, borderColor: borderSubtle }];

  if (!onPress) {
    return (
      <View testID={testID} style={fieldStyle}>
        <Icon size={18} color={secondary} />
        {content}
      </View>
    );
  }

  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={fieldStyle}>
      <Icon size={18} color={secondary} />
      {content}
    </Pressable>
  );
}

export function PencilEntryTextInputField(props: {
  readonly icon: PencilEntryFieldProps["icon"];
  readonly label: string;
  readonly onChangeText: (text: string) => void;
  readonly value: string;
}) {
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");

  return (
    <PencilEntryField icon={props.icon} label={props.label}>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.label}
        placeholderTextColor={tertiary}
        maxLength={200}
        style={[styles.fieldInput, { color: primary }]}
      />
    </PencilEntryField>
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
}: PencilEntryScaffoldProps) {
  const tabBarWidth = useSharedValue(0);
  const { t } = useTranslation();
  const page = useThemeColor("page");
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const accentRed = useThemeColor("accentRed");
  const keyBg = useThemeColor("numpadKey");
  const specialKeyBg = useThemeColor("numpadSpecialKey");
  const activeColor = getTabIndicatorColor({ accentGreen, accentRed, tab: activeTab, tertiary });
  const { bottom, top } = useSafeAreaInsets();
  const tabBarClearance =
    Platform.OS === "ios" ? Math.max(bottom, 16) : ANDROID_TAB_BAR_HEIGHT + Math.max(bottom, 16);
  const activeTabIndex = tabs.findIndex((tab) => tab.key === activeTab);
  const animatedTabLineStyle = useAnimatedStyle(() => {
    const tabWidth = tabs.length > 0 ? tabBarWidth.value / tabs.length : 0;
    const translateX =
      activeTabIndex < 0
        ? 0
        : activeTabIndex * tabWidth + Math.max((tabWidth - TAB_LINE_WIDTH) / 2, 0);

    return {
      backgroundColor: withTiming(activeColor, { duration: 180 }),
      transform: [{ translateX: withTiming(translateX, { duration: 180 }) }],
    };
  });
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
          backgroundColor: page,
          paddingBottom: tabBarClearance,
          paddingTop: top + 20,
        },
      ]}
    >
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
                  { color: isActive ? primary : tertiary, fontWeight: isActive ? "700" : "600" },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        <Animated.View style={[styles.tabLine, animatedTabLineStyle]} />
      </View>

      <GestureDetector gesture={tabSwipe}>
        <View style={styles.swipeArea}>
          <View style={styles.amountArea}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.35}
              style={[styles.amount, { color: primary }]}
            >
              {amount || "$0"}
            </Text>
          </View>

          <View style={styles.fields}>{fields}</View>

          <View style={styles.numpad}>
            {PENCIL_ENTRY_ROWS.map((row) => (
              <View key={row.join("-")} style={styles.numpadRow}>
                {row.map((key) => {
                  if (key === "delete") {
                    return (
                      <View key={key} style={styles.rightColumn}>
                        <Pressable
                          style={[styles.key, { backgroundColor: specialKeyBg }]}
                          onPress={() => onKeyPress(key)}
                          accessibilityRole="button"
                          accessibilityLabel={t("common.delete")}
                        >
                          <Delete size={20} color={tertiary} />
                        </Pressable>
                        <Pressable
                          testID="keyConfirm"
                          style={[
                            styles.key,
                            {
                              backgroundColor: accentGreen,
                              opacity: isConfirmDisabled ? 0.45 : 1,
                            },
                          ]}
                          disabled={isConfirmDisabled}
                          onPress={isConfirmDisabled ? undefined : onConfirm}
                          accessibilityRole="button"
                        >
                          <Check size={22} color={onAccent} />
                        </Pressable>
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={key}
                      style={[styles.key, { backgroundColor: keyBg }]}
                      onPress={() => onKeyPress(key)}
                      accessibilityRole="button"
                      accessibilityLabel={key}
                    >
                      <Text style={[styles.keyText, { color: primary }]}>{key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.bottomSpacer} />
        </View>
      </GestureDetector>
    </View>
  );
}
