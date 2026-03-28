import * as Haptics from "expo-haptics";
import { Plus } from "@/shared/components/icons";
import { Platform, Pressable, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type AddNavButtonProps = {
  onPress: () => void;
  onLongPress?: () => void;
};

export const AddNavButton = ({ onPress, onLongPress }: AddNavButtonProps) => {
  const iconColor = useThemeColor("accentGreen");

  const handleLongPress = () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onLongPress?.();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
    >
      <View className="h-12 w-12 items-center justify-center rounded-full border-2 border-accent-green dark:border-accent-green-dark bg-nav dark:bg-nav-dark">
        <Plus size={22} color={iconColor} />
      </View>
    </Pressable>
  );
};
