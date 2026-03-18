import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { formatCents } from "@/features/transactions";
import { Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type CompactBalanceBarProps = {
  readonly balanceCents: number;
  readonly scrollY: SharedValue<number>;
  readonly threshold: number;
};

export function CompactBalanceBar({ balanceCents, scrollY, threshold }: CompactBalanceBarProps) {
  const primaryColor = useThemeColor("primary");

  const animatedStyle = useAnimatedStyle(() => {
    // Hide until layout is measured (threshold < 0 means not yet measured)
    if (threshold < 0) return { opacity: 0 };
    return {
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
    };
  });

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
