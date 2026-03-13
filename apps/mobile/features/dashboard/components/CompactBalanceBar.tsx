import { TrendingUp } from "lucide-react-native";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { formatCents } from "@/features/transactions/lib/format-amount";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

type CompactBalanceBarProps = {
  balanceCents: number;
  scrollY: SharedValue<number>;
  balanceSectionBottom: SharedValue<number>;
};

export function CompactBalanceBar({
  balanceCents,
  scrollY,
  balanceSectionBottom,
}: CompactBalanceBarProps) {
  const greenColor = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const barStyle = useAnimatedStyle(() => ({
    opacity: withTiming(
      scrollY.value > balanceSectionBottom.value ? 1 : 0,
      { duration: 150 }
    ),
  }));

  const barProps = useAnimatedProps(() => ({
    pointerEvents: (scrollY.value > balanceSectionBottom.value
      ? "auto"
      : "none") as "auto" | "none",
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingHorizontal: 16,
          paddingVertical: 6,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        },
        barStyle,
      ]}
      animatedProps={barProps}
      className="bg-page dark:bg-page-dark"
    >
      <Text className="font-poppins-bold text-body text-primary dark:text-primary-dark">
        {formatCents(balanceCents)}
      </Text>
      <View className="flex-row items-center gap-1">
        <TrendingUp size={12} color={greenColor} />
        <Text className="font-poppins-medium text-label text-accent-green dark:text-accent-green-dark">
          +2.4%
        </Text>
      </View>
    </Animated.View>
  );
}
