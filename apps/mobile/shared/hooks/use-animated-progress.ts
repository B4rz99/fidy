import { useEffect } from "react";
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * Returns an animated style with a horizontal scale driven by `value` (0-1).
 * Use for progress bars that animate smoothly on value change.
 */
export function useAnimatedProgress(
  value: number,
  duration = 600
): {
  progress: SharedValue<number>;
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
} {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(value, { duration });
  }, [value, progress, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return { progress, animatedStyle };
}
