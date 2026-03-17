import { TriangleAlert } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useEmailCaptureStore } from "../store";

export const FailedEmailsBanner = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
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
          {t("emailCapture.unprocessedEmails", { count: failedCount })}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {t("emailCapture.tapToReview")}
        </Text>
      </View>
    </Pressable>
  );
};
