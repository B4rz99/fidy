import { useEffect } from "react";
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export function usePulsingOpacity(
  active: boolean,
  min = 0.3,
  duration = 600
): {
  opacity: SharedValue<number>;
  pulsingStyle: { opacity: number };
} {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(withTiming(min, { duration }), withTiming(1, { duration })),
        -1
      );
    } else {
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [active, opacity, min, duration]);

  const pulsingStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return { opacity, pulsingStyle };
}
