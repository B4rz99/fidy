import { Text, View } from "react-native";

export default function AddTransactionTab() {
  return (
    <View className="flex-1 items-center justify-center bg-page dark:bg-page-dark">
      <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
        Add Transaction
      </Text>
    </View>
  );
}
