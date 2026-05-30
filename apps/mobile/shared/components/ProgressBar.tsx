import Animated, {
  type AnimatedStyle,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from "@/shared/components/rn";
import { useAnimatedProgress, useThemeColor } from "@/shared/hooks";

type Props = {
  readonly percent: number;
  readonly height?: number;
  readonly completeTone?: "danger" | "success";
  readonly shimmering?: boolean;
};

const SHIMMER_WIDTH = 72;

export function ProgressBar({
  percent,
  height = 8,
  completeTone = "danger",
  shimmering = false,
}: Props) {
  const { width } = useWindowDimensions();
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");
  const shimmerTranslateX = useDerivedValue(() =>
    shimmering
      ? withRepeat(
          withSequence(
            withTiming(width + SHIMMER_WIDTH, {
              duration: 1300,
              easing: Easing.inOut(Easing.quad),
            }),
            withTiming(-SHIMMER_WIDTH, { duration: 0 })
          ),
          -1,
          false
        )
      : -SHIMMER_WIDTH
  );

  const { animatedStyle } = useAnimatedProgress(Math.min(percent, 100) / 100, 600);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslateX.value }],
  }));

  const barColor = percent >= 100 && completeTone === "danger" ? accentRed : accentGreen;

  return (
    <View style={[styles.track, { height, backgroundColor: borderColor }]}>
      <Animated.View
        style={[
          styles.fill,
          { height, backgroundColor: barColor },
          animatedStyle as AnimatedStyle<ViewStyle>,
        ]}
      />
      {shimmering ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.shimmer, { height, width: SHIMMER_WIDTH }, shimmerStyle]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 4, overflow: "hidden", position: "relative" },
  fill: { borderRadius: 4, transformOrigin: "left center", width: "100%" },
  shimmer: {
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    borderRadius: 4,
    position: "absolute",
    top: 0,
  },
});
