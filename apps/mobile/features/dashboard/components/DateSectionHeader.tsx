import { memo } from "react";
import { Text, View } from "react-native";

type DateSectionHeaderProps = {
  label: string;
};

export const DateSectionHeader = memo(function DateSectionHeader({
  label,
}: DateSectionHeaderProps) {
  return (
    <View className="py-2">
      <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
        {label}
      </Text>
    </View>
  );
});
