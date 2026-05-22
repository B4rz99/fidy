import { useColorScheme, useThemeColor } from "@/shared/hooks";

export const useAiSupportTextColor = (): string => {
  const colorScheme = useColorScheme();
  const accentGreen = useThemeColor("accentGreen");
  const primary = useThemeColor("primary");
  return colorScheme === "dark" ? accentGreen || primary : primary;
};
