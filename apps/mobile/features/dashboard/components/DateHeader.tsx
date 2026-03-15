import { memo } from "react";
import { Text, View } from "react-native";

type DateHeaderProps = {
  readonly label: string;
};

export const DateHeader = memo(function DateHeader({ label }: DateHeaderProps) {
  return (
    <View className="bg-page px-4 py-2 dark:bg-page-dark">
      <Text className="font-poppins-semibold text-caption uppercase tracking-widest text-secondary dark:text-secondary-dark">
        {label}
      </Text>
    </View>
  );
});
