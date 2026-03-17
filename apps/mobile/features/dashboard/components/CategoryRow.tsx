import { Text, View } from "@/shared/components/rn";

type CategoryRowProps = {
  readonly color: string;
  readonly name: string;
  readonly amount: string;
};

export const CategoryRow = ({ color, name, amount }: CategoryRowProps) => (
  <View className="flex-row items-center">
    <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    <Text className="ml-2 font-poppins-medium text-body text-primary dark:text-primary-dark">
      {name}
    </Text>
    <View className="flex-1" />
    <Text className="font-poppins-medium text-body text-primary dark:text-primary-dark">
      {amount}
    </Text>
  </View>
);
