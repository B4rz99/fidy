import { useEffect } from "react";
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Returns a Reanimated animated style that blinks opacity on/off at ~1Hz.
 * Use for text-cursor indicators in amount-input screens.
 */
export function useBlinkingCursor(): {
  cursorOpacity: SharedValue<number>;
  cursorStyle: { opacity: number };
} {
  const cursorOpacity = useSharedValue(1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: animation runs once on mount
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: 530 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 530 })
      ),
      -1
    );
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return { cursorOpacity, cursorStyle };
}
