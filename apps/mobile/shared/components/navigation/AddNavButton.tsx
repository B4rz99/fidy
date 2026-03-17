import { Plus } from "@/shared/components/icons";
import { Pressable, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type AddNavButtonProps = {
  onPress: () => void;
};

export const AddNavButton = ({ onPress }: AddNavButtonProps) => {
  const iconColor = useThemeColor("accentGreen");

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Add transaction">
      <View className="h-12 w-12 items-center justify-center rounded-full border-2 border-accent-green dark:border-accent-green-dark bg-nav dark:bg-nav-dark">
        <Plus size={22} color={iconColor} />
      </View>
    </Pressable>
  );
};
