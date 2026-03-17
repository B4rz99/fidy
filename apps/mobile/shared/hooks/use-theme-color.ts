import { useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";

export const useThemeColor = (colorName: keyof typeof Colors.light): string => {
  const scheme = useColorScheme();
  const resolved = scheme === "dark" ? "dark" : "light";
  return Colors[resolved][colorName];
};
