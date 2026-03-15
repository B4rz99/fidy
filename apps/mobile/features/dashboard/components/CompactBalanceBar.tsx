import { Text } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { formatCents } from "@/features/transactions/lib/format-amount";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

type CompactBalanceBarProps = {
  readonly balanceCents: number;
  readonly scrollY: SharedValue<number>;
  readonly threshold: number;
};

export function CompactBalanceBar({ balanceCents, scrollY, threshold }: CompactBalanceBarProps) {
  const primaryColor = useThemeColor("primary");

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [threshold - 20, threshold], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [threshold - 20, threshold],
          [-10, 0],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text
        className="font-poppins-bold text-body text-primary dark:text-primary-dark"
        style={{ color: primaryColor }}
      >
        {formatCents(balanceCents)}
      </Text>
    </Animated.View>
  );
}
