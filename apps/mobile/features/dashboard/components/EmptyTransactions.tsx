import { BarChart3 } from "lucide-react-native";
import { Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

export const EmptyTransactions = () => {
  const mutedColor = useThemeColor("secondary");

  return (
    <View className="items-center px-8 py-16" style={{ gap: 8 }}>
      <BarChart3 size={40} color={mutedColor} strokeWidth={1.5} />
      <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
        No transactions yet
      </Text>
      <Text
        className="font-poppins-medium text-caption text-center"
        style={{ color: mutedColor }}
      >
        Connect an email account or add transactions manually to get started
      </Text>
    </View>
  );
};
