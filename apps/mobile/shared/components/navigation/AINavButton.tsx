import { Sparkles } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

type AiNavButtonProps = {
  onPress: () => void;
};

export const AiNavButton = ({ onPress }: AiNavButtonProps) => {
  const iconColor = useThemeColor("accentGreen");

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="AI assistant">
      <View className="h-12 w-12 items-center justify-center rounded-full border-2 border-accent-green dark:border-accent-green-dark bg-nav dark:bg-nav-dark">
        <Sparkles size={22} color={iconColor} />
      </View>
    </Pressable>
  );
};
