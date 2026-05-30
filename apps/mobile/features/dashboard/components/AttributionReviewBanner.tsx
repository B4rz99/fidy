import { useOptionalUserId } from "@/features/auth/public";
import { useAttributionReviewQueue } from "@/features/review-queues/public";
import { Callout } from "@/shared/components";
import { ChevronRight, Landmark } from "@/shared/components/icons";
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
    <Callout
      title={t("attributionReview.bannerTitle", { count })}
      subtitle={t("attributionReview.bannerSubtitle")}
      tone="success"
      icon={<Landmark size={18} color="#4A7F1B" />}
      trailing={<ChevronRight size={16} color="#55703B" />}
      onPress={onPress}
      className="rounded-xl p-3"
      style={{ backgroundColor: "#D4EDBA", gap: 12 }}
    />
  );
};
