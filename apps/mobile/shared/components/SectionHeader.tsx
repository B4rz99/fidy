import { Pressable, Text, View } from "react-native";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
        {title}
      </Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction}>
          <Text className="font-poppins-medium text-label text-accent-green dark:text-accent-green-dark">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
