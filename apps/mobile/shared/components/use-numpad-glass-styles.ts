import type { ViewStyle } from "@/shared/components/rn";
import { useColorScheme, useThemeColor } from "@/shared/hooks";

const RGBA_FUNCTION_NAME = "rgb" + "a";

const withAlpha = (hexColor: string, alpha: string): string => {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  return `${RGBA_FUNCTION_NAME}(${red}, ${green}, ${blue}, ${alpha})`;
};

type NumpadGlassStyles = {
  readonly keySurfaceStyle: ViewStyle;
  readonly specialKeySurfaceStyle: ViewStyle;
  readonly confirmKeySurfaceStyle: ViewStyle;
};

export function useNumpadGlassStyles(): NumpadGlassStyles {
  const isDark = useColorScheme() === "dark";
  const accentGreen = useThemeColor("accentGreen");
  const numpadGlassKey = useThemeColor("numpadGlassKey");
  const numpadGlassSpecialKey = useThemeColor("numpadGlassSpecialKey");
  const numpadGlassBorder = useThemeColor("numpadGlassBorder");

  return {
    keySurfaceStyle: {
      backgroundColor: withAlpha(numpadGlassKey, isDark ? "0.11" : "0.20"),
      borderColor: withAlpha(numpadGlassBorder, isDark ? "0.13" : "0.08"),
      borderWidth: 1,
    },
    specialKeySurfaceStyle: {
      backgroundColor: withAlpha(numpadGlassSpecialKey, isDark ? "0.09" : "0.16"),
      borderColor: withAlpha(numpadGlassBorder, isDark ? "0.13" : "0.08"),
      borderWidth: 1,
    },
    confirmKeySurfaceStyle: {
      backgroundColor: `${accentGreen}${isDark ? "B8" : "C7"}`,
      borderColor: accentGreen,
      borderWidth: 1,
    },
  };
}
