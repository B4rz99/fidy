import { useCallback, type ReactNode } from "react";
import * as Haptics from "expo-haptics";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";
import { GlassSurface } from "./GlassSurface";
import { ListRowSurface } from "./ListRowSurface";

type TransactionRowProps = {
  icon: string;
  iconBgColor?: string;
  iconColor?: string;
  name: string;
  date?: string;
  amount: string;
  category: string;
  isPositive?: boolean;
  amountTone?: "positive" | "negative" | "neutral";
  onEdit?: () => void;
  onDelete?: () => void;
};

const SWIPE_ACTION_WIDTH = 88;

type SwipeActionPanelProps = {
  readonly actionWidth: number;
  readonly children: ReactNode;
  readonly translation: SharedValue<number>;
};

function SwipeActionPanel({ actionWidth, children, translation }: SwipeActionPanelProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(translation.value + actionWidth, 0) }],
  }));

  return (
    <Animated.View
      className="flex-row items-stretch py-3"
      style={[styles.swipeActionPanel, { width: actionWidth }, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

function getAmountClassName(amountTone: NonNullable<TransactionRowProps["amountTone"]>): string {
  if (amountTone === "positive") return "text-accent-green dark:text-accent-green-dark";
  if (amountTone === "neutral") return "text-primary dark:text-primary-dark";
  return "text-accent-red dark:text-accent-red-dark";
}

export function TransactionRow({
  icon,
  iconBgColor: _iconBgColor,
  iconColor: iconColorOverride,
  name,
  date,
  amount,
  category,
  isPositive = false,
  amountTone,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const defaultIconColor = useThemeColor("tertiary");
  const secondaryColor = useThemeColor("secondary");
  const accentRed = useThemeColor("accentRed");
  const iconColor = iconColorOverride ?? defaultIconColor;
  const { t } = useTranslation();
  const resolvedAmountTone = amountTone ?? (isPositive ? "positive" : "negative");
  const amountClassName = getAmountClassName(resolvedAmountTone);

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== "ios") return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options = [
      ...(onEdit ? [t("common.edit")] : []),
      ...(onDelete ? [t("common.delete")] : []),
      t("common.cancel"),
    ];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = onDelete ? options.indexOf(t("common.delete")) : undefined;

    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex, destructiveButtonIndex },
      (buttonIndex) => {
        const selected = options[buttonIndex];
        if (selected === t("common.edit")) onEdit?.();
        if (selected === t("common.delete")) onDelete?.();
      }
    );
  }, [onEdit, onDelete, t]);

  const renderRightActions = useCallback(
    (
      _progress: SharedValue<number>,
      _translation: SharedValue<number>,
      swipeable: SwipeableMethods
    ) => {
      const actionCount = Number(onEdit != null) + Number(onDelete != null);
      const actionWidth = SWIPE_ACTION_WIDTH * actionCount;
      const handleEditPress = () => {
        swipeable.close();
        void Haptics.selectionAsync();
        onEdit?.();
      };
      const handleDeletePress = () => {
        swipeable.close();
        void Haptics.selectionAsync();
        onDelete?.();
      };

      return (
        <SwipeActionPanel actionWidth={actionWidth} translation={_translation}>
          {onEdit ? (
            <GlassPressable
              accessibilityRole="button"
              accessibilityLabel={t("common.edit")}
              radius={0}
              padded={false}
              surfaceLayoutStyle={styles.swipeAction}
              onPress={handleEditPress}
            >
              <Text
                className="font-poppins-semibold text-caption"
                style={{ color: secondaryColor }}
              >
                {t("common.edit")}
              </Text>
            </GlassPressable>
          ) : null}
          {onDelete ? (
            <GlassPressable
              accessibilityRole="button"
              accessibilityLabel={t("common.delete")}
              radius={0}
              padded={false}
              surfaceLayoutStyle={styles.swipeAction}
              onPress={handleDeletePress}
            >
              <Text className="font-poppins-semibold text-caption" style={{ color: accentRed }}>
                {t("common.delete")}
              </Text>
            </GlassPressable>
          ) : null}
        </SwipeActionPanel>
      );
    },
    [onDelete, onEdit, t]
  );

  const hasActions = onEdit != null || onDelete != null;

  const content = (
    <ListRowSurface radius={8} minHeight={64} layoutStyle={styles.rowSurface}>
      <GlassSurface
        radius={12}
        padded={false}
        className="size-10 items-center justify-center rounded-icon"
        style={{ alignItems: "center", height: 40, justifyContent: "center", width: 40 }}
      >
        <Text style={{ color: iconColor }}>{icon}</Text>
      </GlassSurface>
      <View className="ml-3 flex-1">
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          {name}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {date ?? category}
        </Text>
      </View>
      <Text className={`font-poppins-semibold text-body ${amountClassName}`}>{amount}</Text>
    </ListRowSurface>
  );

  if (!hasActions) return content;

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={SWIPE_ACTION_WIDTH}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      <Pressable onLongPress={handleLongPress}>{content}</Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  rowSurface: {
    alignItems: "center",
    flexDirection: "row",
    gap: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  swipeActionPanel: {
    overflow: "hidden",
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
  },
});
