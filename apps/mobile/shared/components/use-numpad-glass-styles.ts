import type { ViewStyle } from "@/shared/components/rn";

type NumpadGlassStyles = {
  readonly keySurfaceStyle: ViewStyle;
  readonly specialKeySurfaceStyle: ViewStyle;
  readonly confirmKeySurfaceStyle: ViewStyle;
};

export function useNumpadGlassStyles(): NumpadGlassStyles {
  return {
    keySurfaceStyle: {},
    specialKeySurfaceStyle: {},
    confirmKeySurfaceStyle: {},
  };
}
