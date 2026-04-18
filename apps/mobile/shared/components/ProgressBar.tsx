import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { StyleSheet, View, type ViewStyle } from "@/shared/components/rn";
import { useAnimatedProgress, useThemeColor } from "@/shared/hooks";

type Props = {
  readonly percent: number;
  readonly height?: number;
};

export function ProgressBar({ percent, height = 8 }: Props) {
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");

  const { animatedStyle } = useAnimatedProgress(Math.min(percent, 100) / 100, 600);

  const barColor = percent >= 100 ? accentRed : accentGreen;

  return (
    <View style={[styles.track, { height, backgroundColor: borderColor }]}>
      <Animated.View
        style={[
          styles.fill,
          { height, backgroundColor: barColor },
          animatedStyle as AnimatedStyle<ViewStyle>,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 4, overflow: "hidden" },
  fill: { borderRadius: 4 },
});
