import { useOptionalUserId } from "@/features/auth/public";
import { useAttributionReviewQueue } from "@/features/review-queues/public";
import { ChevronRight, Landmark } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useTranslation } from "@/shared/hooks";

export const AttributionReviewBanner = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { items } = useAttributionReviewQueue({ db, userId });
  const count = items.length;

  if (count === 0) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-xl p-3"
      style={{ backgroundColor: "#D4EDBA", gap: 12 }}
    >
      <View className="flex-1 flex-row items-center" style={{ gap: 10 }}>
        <Landmark size={18} color="#4A7F1B" />
        <View>
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {t("attributionReview.bannerTitle", { count })}
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: "#55703B" }}>
            {t("attributionReview.bannerSubtitle")}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color="#55703B" />
    </Pressable>
  );
};
