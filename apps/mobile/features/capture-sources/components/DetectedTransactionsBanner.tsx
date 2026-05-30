import { Callout } from "@/shared/components";
import { ChevronRight, MessageSquare } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useCaptureSourcesStore } from "../store";

export const DetectedTransactionsBanner = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  const count = useCaptureSourcesStore((s) => s.detectedSmsCount);
  const iconColor = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");

  if (count === 0) return null;
  return (
    <Callout
      title={t("detectedTransactions.count", { count })}
      subtitle={t("detectedTransactions.subtitle")}
      icon={<MessageSquare size={18} color={iconColor} />}
      trailing={<ChevronRight size={16} color={secondaryColor} />}
      onPress={onPress}
      tone="success"
    />
  );
};
