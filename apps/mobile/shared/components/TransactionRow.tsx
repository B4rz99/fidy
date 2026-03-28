import * as Haptics from "expo-haptics";
import { useMemo, useRef } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { LucideIcon } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type TransactionRowProps = {
  icon: LucideIcon;
  iconBgColor?: string;
  name: string;
  date?: string;
  amount: string;
  category: string;
  isPositive?: boolean;
  onEdit?: () => void;
};

export function TransactionRow({
  icon: Icon,
  iconBgColor,
  name,
  date,
  amount,
  category,
  isPositive = false,
  onEdit,
}: TransactionRowProps) {
  const defaultIconBg = useThemeColor("peachLight");
  const iconColor = useThemeColor("tertiary");

  const pressed = useSharedValue(false);
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;

  const longPress = useMemo(() => {
    if (!onEdit) return null;

    const fire = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onEditRef.current?.();
    };

    return Gesture.LongPress()
      .minDuration(100)
      .onBegin(() => {
        pressed.value = true;
      })
      .onStart(() => {
        runOnJS(fire)();
      })
      .onFinalize(() => {
        pressed.value = false;
      });
  }, [pressed, onEdit]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pressed.value ? 0.7 : 1,
  }));

  const content = (
    <View className="flex-row items-center py-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-icon"
        style={{ backgroundColor: iconBgColor ?? defaultIconBg }}
      >
        <Icon size={20} color={iconColor} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-poppins-medium text-body text-primary dark:text-primary-dark">
          {name}
        </Text>
        {date != null && (
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            {date}
          </Text>
        )}
      </View>
      <View className="items-end">
        <Text
          className={`font-poppins-semibold text-body ${
            isPositive
              ? "text-accent-green dark:text-accent-green-dark"
              : "text-accent-red dark:text-accent-red-dark"
          }`}
        >
          {amount}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {category}
        </Text>
      </View>
    </View>
  );

  if (!longPress) return content;

  return (
    <GestureDetector gesture={longPress}>
      <Animated.View style={animatedStyle}>{content}</Animated.View>
    </GestureDetector>
  );
}
