import { ChevronRight, TriangleAlert } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useEmailCaptureStore } from "@/features/email-capture";

export const NeedsReviewBanner = ({ onPress }: { onPress: () => void }) => {
  const count = useEmailCaptureStore((s) => s.needsReviewEmails.length);

  if (count === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-xl p-3"
      style={{ backgroundColor: "#FFF3E0", gap: 12 }}
    >
      <View className="flex-1 flex-row items-center" style={{ gap: 10 }}>
        <TriangleAlert size={18} color="#E65100" />
        <View>
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {count} {count === 1 ? "transaction needs" : "transactions need"} review
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
            Low confidence parses
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color="#6D6D6D" />
    </Pressable>
  );
};
