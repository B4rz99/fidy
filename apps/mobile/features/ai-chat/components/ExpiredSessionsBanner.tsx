import { Callout } from "@/shared/components";
import { Clock } from "@/shared/components/icons";
import { useTranslation } from "@/shared/hooks";
import { useChatStore } from "../store";

export function ExpiredSessionsBanner() {
  const { t } = useTranslation();
  const count = useChatStore((s) => s.expiredSessionCount);
  const dismiss = useChatStore((s) => s.dismissExpiredBanner);

  if (count === 0) return null;

  return (
    <Callout
      title={t("aiChat.cleanupMessage", { count })}
      tone="warning"
      icon={<Clock size={18} color="#E65100" />}
      onDismiss={dismiss}
      dismissAccessibilityLabel={t("common.dismiss")}
    />
  );
}
