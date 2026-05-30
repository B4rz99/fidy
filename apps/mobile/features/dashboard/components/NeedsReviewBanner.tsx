import {
  selectNeedsReviewBannerCount,
  useEmailCaptureStore,
} from "@/features/email-capture/public";
import { Callout } from "@/shared/components";
import { ChevronRight, TriangleAlert } from "@/shared/components/icons";
import { useTranslation } from "@/shared/hooks";

export const NeedsReviewBanner = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  const count = useEmailCaptureStore(selectNeedsReviewBannerCount);

  if (count === 0) return null;

  return (
    <Callout
      title={t("financialMeaningReview.bannerTitle", { count })}
      subtitle={t("financialMeaningReview.bannerSubtitle")}
      tone="warning"
      icon={<TriangleAlert size={18} color="#E65100" />}
      trailing={<ChevronRight size={16} color="#6D6D6D" />}
      onPress={onPress}
      className="rounded-xl p-3"
      style={{ backgroundColor: "#FFF3E0", gap: 12 }}
    />
  );
};
