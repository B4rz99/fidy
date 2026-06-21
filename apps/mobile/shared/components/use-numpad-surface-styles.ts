import type { ViewStyle } from "@/shared/components/rn";

type NumpadSurfaceStyles = {
  readonly keySurfaceStyle: ViewStyle;
  readonly specialKeySurfaceStyle: ViewStyle;
};

export function useNumpadSurfaceStyles(): NumpadSurfaceStyles {
  return {
    keySurfaceStyle: {},
    specialKeySurfaceStyle: {},
  };
}
