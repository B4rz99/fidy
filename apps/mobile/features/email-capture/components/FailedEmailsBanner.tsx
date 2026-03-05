import { TriangleAlert } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useEmailCaptureStore } from "../store";

export const FailedEmailsBanner = ({ onPress }: { onPress: () => void }) => {
  const failedCount = useEmailCaptureStore((s) => s.failedEmails.length);
  const iconColor = useThemeColor("accentRed");

  if (failedCount === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-chart bg-card p-4 dark:bg-card-dark"
      style={{ gap: 12 }}
    >
      <TriangleAlert size={20} color={iconColor} />
      <View className="flex-1">
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          {failedCount} unprocessed {failedCount === 1 ? "email" : "emails"}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          Tap to review and add manually
        </Text>
      </View>
    </Pressable>
  );
};
