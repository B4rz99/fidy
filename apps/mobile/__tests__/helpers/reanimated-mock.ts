export const FadeIn = { duration: () => ({ duration: () => "FadeIn" }) };
export const FadeOut = { duration: () => ({ duration: () => "FadeOut" }) };
export const cancelAnimation = () => undefined;
export const runOnJS = <T extends (...args: unknown[]) => unknown>(fn: T) => fn;
export const useAnimatedStyle = (fn: () => unknown) => fn();
export const useSharedValue = (init: unknown) => ({ value: init });
export const withRepeat = <T>(val: T) => val;
export const withSequence = <T>(...vals: T[]) => vals[0];
export const withTiming = <T>(val: T) => val;

export default {
  View: "Animated.View",
};
