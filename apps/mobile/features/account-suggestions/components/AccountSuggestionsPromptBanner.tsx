import { Callout } from "@/shared/components";
import { ChevronRight, Sparkles } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type AccountSuggestionsPromptBannerProps = {
  readonly count: number;
  readonly onPress: () => void;
};

export function AccountSuggestionsPromptBanner({
  count,
  onPress,
}: AccountSuggestionsPromptBannerProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const secondary = useThemeColor("secondary");

  if (count === 0) {
    return null;
  }

  return (
    <Callout
      title={t("accountSuggestions.prompt.count", { count })}
      subtitle={t("accountSuggestions.prompt.subtitle")}
      tone="success"
      icon={<Sparkles size={18} color={accentGreen} />}
      trailing={<ChevronRight size={16} color={secondary} />}
      onPress={onPress}
    />
  );
}
