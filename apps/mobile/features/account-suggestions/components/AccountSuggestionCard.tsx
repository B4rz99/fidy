import { Building2, CreditCard, Sparkles, Wallet } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
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

  if (suggestion.evidenceType === "alias_token" || suggestion.evidenceType === "llm_account_hint") {
    return "accountSuggestions.card.reasonAlias";
  }

  return "accountSuggestions.card.reasonLast4";
}

export function AccountSuggestionCard({
  suggestion,
  onCreate,
  onLink,
  onSkip,
}: AccountSuggestionCardProps) {
  const { t } = useTranslation();
  const draft = buildSuggestedFinancialAccountDraft(suggestion);

  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const peachLight = useThemeColor("peachLight");

  return (
    <View style={[styles.card, { backgroundColor: card, borderColor: borderSubtle }]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: accentGreenLight }]}>
          {draft.kind === "wallet" || draft.kind === "cash" ? (
            <Wallet size={20} color={accentGreen} />
          ) : draft.kind === "credit_card" ? (
            <CreditCard size={20} color={accentGreen} />
          ) : (
            <Building2 size={20} color={accentGreen} />
          )}
        </View>
        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: primary }]}>{draft.name}</Text>
          <Text style={[styles.reason, { color: secondary }]}>
            {t(buildReasonKey(suggestion), {
              source: draft.sourceLabel,
              value: suggestion.value,
              evidence: draft.evidenceLabel,
              count: suggestion.occurrences,
            })}
          </Text>
        </View>
        <View style={[styles.confidencePill, { backgroundColor: peachLight }]}>
          <Sparkles size={12} color={tertiary} />
          <Text style={[styles.confidenceText, { color: primary }]}>
            {t(
              draft.confidenceLabel === "HIGH"
                ? "accountSuggestions.card.confidenceHigh"
                : "accountSuggestions.card.confidenceMedium"
            )}
          </Text>
        </View>
      </View>

      <View style={styles.evidenceRow}>
        <View style={[styles.evidencePill, { backgroundColor: peachLight }]}>
          <Text style={[styles.evidenceText, { color: secondary }]}>{draft.sourceLabel}</Text>
        </View>
        <View style={[styles.evidencePill, { backgroundColor: peachLight }]}>
          <Text style={[styles.evidenceText, { color: secondary }]}>{draft.evidenceLabel}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.primaryAction, { backgroundColor: accentGreen }]}
          onPress={() => onCreate(suggestion)}
        >
          <Text style={styles.primaryActionText}>{t("accountSuggestions.card.create")}</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryAction, { backgroundColor: peachLight }]}
          onPress={() => onLink(suggestion)}
        >
          <Text style={[styles.secondaryActionText, { color: primary }]}>
            {t("accountSuggestions.card.linkExisting")}
          </Text>
        </Pressable>
        <Pressable style={styles.skipAction} onPress={() => onSkip(suggestion)}>
          <Text style={[styles.skipActionText, { color: secondary }]}>
            {t("accountSuggestions.card.skipForNow")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
  reason: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 16,
  },
  confidencePill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confidenceText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  evidenceRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  evidencePill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  evidenceText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryActionText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  skipAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  skipActionText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
});
