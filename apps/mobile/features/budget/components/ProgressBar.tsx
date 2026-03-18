import { useEffect } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type Props = {
  readonly percent: number; // 0-100+
  readonly height?: number;
};

export function ProgressBar({ percent, height = 8 }: Props) {
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(percent, 100) / 100, { duration: 600 });
  }, [percent, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: percent >= 100 ? accentRed : accentGreen,
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: borderColor }]}>
      <Animated.View style={[styles.fill, { height }, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 4, overflow: "hidden" },
  fill: { borderRadius: 4 },
});
