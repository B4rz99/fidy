import {
  selectNeedsReviewBannerCount,
  useEmailCaptureStore,
} from "@/features/email-capture/public";
import { ChevronRight, TriangleAlert } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";

export const NeedsReviewBanner = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  const count = useEmailCaptureStore(selectNeedsReviewBannerCount);

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
            {t("financialMeaningReview.bannerTitle", { count })}
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
            {t("financialMeaningReview.bannerSubtitle")}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color="#6D6D6D" />
    </Pressable>
  );
};
