import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

type NavItemProps = {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onPress: () => void;
};

export function NavItem({ icon: Icon, label, isActive, onPress }: NavItemProps) {
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <Pressable onPress={onPress}>
      <View
        className={`flex-row items-center gap-1.5 px-4 py-2 ${isActive ? "bg-accent-green" : ""}`}
        style={{ borderRadius: 999 }}
      >
        <Icon size={18} color={isActive ? "#FFFFFF" : tertiaryColor} />
        <Text
          className={`font-poppins-semibold text-nav uppercase tracking-wider ${
            isActive ? "text-white" : "text-tertiary"
          }`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
