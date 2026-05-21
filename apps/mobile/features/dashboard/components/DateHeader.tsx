import { memo } from "react";
import { Text, View } from "@/shared/components/rn";

type DateHeaderProps = {
  readonly label: string;
};

export const DateHeader = memo(function DateHeader({ label }: DateHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-4">
      <Text className="font-poppins-semibold text-caption uppercase tracking-widest text-secondary dark:text-secondary-dark">
        {label}
      </Text>
    </View>
  );
});
