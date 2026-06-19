import { memo, useCallback } from "react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Chip } from "@/shared/components/Chip";
import { GlassSurface } from "@/shared/components/GlassSurface";
import { Building2, CreditCard, Sparkles, Wallet } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { AccountCreationSuggestion } from "../lib/derive-account-suggestions";
import { buildSuggestedFinancialAccountDraft } from "../lib/presentation";

type AccountSuggestionCardProps = {
  readonly suggestion: AccountCreationSuggestion;
  readonly onCreate: (suggestion: AccountCreationSuggestion) => void;
  readonly onLink: (suggestion: AccountCreationSuggestion) => void;
  readonly onSkip: (suggestion: AccountCreationSuggestion) => void;
};

function buildReasonKey(suggestion: AccountCreationSuggestion) {
  if (suggestion.evidenceType === "card_product_hint") {
    return "accountSuggestions.card.reasonCardProduct";
  }

  if (suggestion.evidenceType === "account_type_hint") {
    return "accountSuggestions.card.reasonAccountType";
  }

  if (suggestion.evidenceType === "card_hint") {
    return "accountSuggestions.card.reasonCardHint";
  }

  if (suggestion.evidenceType === "alias_token") {
    return "accountSuggestions.card.reasonAlias";
  }

  return "accountSuggestions.card.reasonLast4";
}

function getAccountIcon(kind: string) {
  if (kind === "wallet" || kind === "cash") return Wallet;
  if (kind === "credit_card") return CreditCard;
  return Building2;
}

function AccountSuggestionCardInner({
  suggestion,
  onCreate,
  onLink,
  onSkip,
}: AccountSuggestionCardProps) {
  const { t } = useTranslation();
  const draft = buildSuggestedFinancialAccountDraft(suggestion);

  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const AccountIcon = getAccountIcon(draft.kind);
  const handleCreate = useCallback(() => onCreate(suggestion), [onCreate, suggestion]);
  const handleLink = useCallback(() => onLink(suggestion), [onLink, suggestion]);
  const handleSkip = useCallback(() => onSkip(suggestion), [onSkip, suggestion]);

  return (
    <Card padded={false} contentStyle={{ gap: 14, padding: 18 }}>
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <GlassSurface
          radius={14}
          padded={false}
          className="size-11 items-center justify-center"
          style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
        >
          <AccountIcon size={20} color={accentGreen} />
        </GlassSurface>
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="font-poppins-semibold text-section text-text-primary dark:text-text-primary-dark">
            {draft.name}
          </Text>
          <Text className="font-poppins-medium text-caption text-text-secondary dark:text-text-secondary-dark">
            {t(buildReasonKey(suggestion), {
              source: draft.sourceLabel,
              value: suggestion.value,
              evidence: draft.evidenceLabel,
              count: suggestion.occurrences,
            })}
          </Text>
        </View>
        <Chip
          label={t(
            draft.confidenceLabel === "HIGH"
              ? "accountSuggestions.card.confidenceHigh"
              : "accountSuggestions.card.confidenceMedium"
          )}
          leading={<Sparkles size={12} color={tertiary} />}
          size="compact"
        />
      </View>

      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <Chip label={draft.sourceLabel} size="compact" />
        <Chip label={draft.evidenceLabel} size="compact" />
      </View>

      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Button
          label={t("accountSuggestions.card.create")}
          onPress={handleCreate}
          size="compact"
          className="flex-1 rounded-[14px]"
        />
        <Button
          label={t("accountSuggestions.card.linkExisting")}
          onPress={handleLink}
          variant="secondary"
          size="compact"
          className="rounded-[14px] px-3.5"
        />
        <Button
          label={t("accountSuggestions.card.skipForNow")}
          onPress={handleSkip}
          variant="ghost"
          size="compact"
          className="px-1"
        />
      </View>
    </Card>
  );
}

export const AccountSuggestionCard = memo(AccountSuggestionCardInner);
