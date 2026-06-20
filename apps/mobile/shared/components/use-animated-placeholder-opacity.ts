import { useEffect, useRef } from "react";
import { Animated } from "@/shared/components/rn";

export function useAnimatedPlaceholderOpacity(visible: boolean) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      duration: 140,
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  return opacity;
}
