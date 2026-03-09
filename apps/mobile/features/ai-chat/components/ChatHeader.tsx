import { ChevronLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

type ChatHeaderProps = {
  readonly title: string;
  readonly onBack: () => void;
  readonly topInset: number;
};

export function ChatHeader({ title, onBack, topInset }: ChatHeaderProps) {
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View
      style={{
        paddingTop: topInset + 12,
        paddingBottom: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: borderSubtle,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onBack} hitSlop={12}>
          <ChevronLeft size={24} color={primary} />
        </Pressable>
        <Text
          className="font-poppins-bold text-primary dark:text-primary-dark"
          style={{ fontSize: 18 }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}
