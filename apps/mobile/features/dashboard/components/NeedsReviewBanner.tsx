import {
  selectNeedsReviewBannerCount,
  useEmailCaptureStore,
} from "@/features/email-capture/public";
import { Callout } from "@/shared/components";
import { ChevronRight, TriangleAlert } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export const NeedsReviewBanner = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  const secondary = useThemeColor("secondary");
  const warning = useThemeColor("warning");
  const count = useEmailCaptureStore(selectNeedsReviewBannerCount);

  if (count === 0) return null;

  return (
    <Callout
      title={t("financialMeaningReview.bannerTitle", { count })}
      subtitle={t("financialMeaningReview.bannerSubtitle")}
      tone="warning"
      icon={<TriangleAlert size={18} color={warning} />}
      trailing={<ChevronRight size={16} color={secondary} />}
      onPress={onPress}
    />
  );
};
