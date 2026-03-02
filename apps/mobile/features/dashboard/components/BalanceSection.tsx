import { TrendingUp } from "lucide-react-native";
import { Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { balanceData } from "../data/mock-data";

export const BalanceSection = () => {
  const greenColor = useThemeColor("accentGreen");

  return (
    <View className="items-center gap-1 py-4">
      <Text className="font-poppins-medium text-label uppercase tracking-widest text-tertiary dark:text-tertiary-dark">
        TOTAL BALANCE
      </Text>
      <Text className="font-poppins-bold text-balance text-primary dark:text-primary-dark">
        {balanceData.total}
      </Text>
      <View className="flex-row items-center gap-1">
        <TrendingUp size={14} color={greenColor} />
        <Text className="font-poppins-medium text-label text-accent-green dark:text-accent-green-dark">
          {balanceData.trend} {balanceData.trendLabel}
        </Text>
      </View>
    </View>
  );
};
