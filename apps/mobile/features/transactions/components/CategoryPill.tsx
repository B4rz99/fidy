import * as Haptics from "expo-haptics";
import { Pressable, Text } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import type { Category } from "../lib/categories";

type CategoryPillProps = {
  category: Category;
  isSelected: boolean;
  onPress: () => void;
};

export const CategoryPill = ({ category, isSelected, onPress }: CategoryPillProps) => {
  const peachLight = useThemeColor("peachLight");
  const primary = useThemeColor("primary");
  const Icon = category.icon;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      className="flex-1 h-9 flex-row items-center justify-center gap-1.5 rounded-full px-2"
      style={{
        backgroundColor: isSelected ? category.color : peachLight,
      }}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={category.label}
    >
      <Icon size={16} color={isSelected ? "#FFFFFF" : category.color} />
      <Text
        className="font-poppins-medium text-[13px]"
        style={{ color: isSelected ? "#FFFFFF" : primary }}
        numberOfLines={1}
      >
        {category.label}
      </Text>
    </Pressable>
  );
};
