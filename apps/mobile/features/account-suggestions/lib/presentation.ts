import type { FinancialAccountKind, FinancialAccountRow } from "@/features/financial-accounts";
import type { AccountCreationSuggestion } from "./derive-account-suggestions";

type SuggestedFinancialAccountDraft = {
  readonly kind: FinancialAccountKind;
  readonly name: string;
  readonly sourceLabel: string;
  readonly evidenceLabel: string;
  readonly confidenceLabel: "HIGH" | "MED";
  readonly occurrences: number;
};

type RankedSuggestedFinancialAccount = {
  readonly account: FinancialAccountRow;
  readonly isLikelyMatch: boolean;
};

const WALLET_SOURCE_FAMILIES = new Set(["nequi", "daviplata", "wallet"]);

function toTitleCaseSegment(segment: string) {
  return segment.length === 0 ? segment : `${segment[0]?.toUpperCase()}${segment.slice(1)}`;
}

function normalizeLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => toTitleCaseSegment(segment))
    .join(" ");
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildEvidenceLabel(suggestion: AccountCreationSuggestion) {
  return suggestion.evidenceType === "last4" ? `••${suggestion.value}` : suggestion.value;
}

function inferKind(suggestion: AccountCreationSuggestion): FinancialAccountKind {
  if (suggestion.evidenceType === "card_hint") {
    return "credit_card";
  }

  if (
    suggestion.evidenceType === "alias_token" &&
    (WALLET_SOURCE_FAMILIES.has(suggestion.sourceFamily) ||
      normalizeSearchText(suggestion.value).includes("wallet"))
  ) {
    return "wallet";
  }

  return "checking";
}

function buildSuggestedName(
  sourceLabel: string,
  evidenceLabel: string,
  kind: FinancialAccountKind
) {
  if (kind === "wallet") {
    return `${sourceLabel} wallet`;
  }

  if (kind === "credit_card") {
    return `${sourceLabel} card`;
  }

  return `${sourceLabel} ${evidenceLabel}`;
}

function toConfidenceLabel(suggestion: AccountCreationSuggestion): "HIGH" | "MED" {
  return suggestion.evidenceType === "last4" ? "HIGH" : "MED";
}

function scoreSuggestedFinancialAccount(
  account: FinancialAccountRow,
  draft: SuggestedFinancialAccountDraft
) {
  const normalizedName = normalizeSearchText(account.name);
  const normalizedSource = normalizeSearchText(draft.sourceLabel);
  const normalizedEvidence = normalizeSearchText(draft.evidenceLabel.replaceAll("•", ""));
  const kindScore = account.kind === draft.kind ? 4 : 0;
  const sourceScore = normalizedName.includes(normalizedSource) ? 2 : 0;
  const evidenceScore =
    normalizedEvidence.length > 0 && normalizedName.includes(normalizedEvidence) ? 1 : 0;
  const defaultPenalty = account.isDefault ? -1 : 0;

  return kindScore + sourceScore + evidenceScore + defaultPenalty;
}

export function buildSuggestedFinancialAccountDraft(
  suggestion: AccountCreationSuggestion
): SuggestedFinancialAccountDraft {
  const sourceLabel = normalizeLabel(suggestion.sourceFamily);
  const evidenceLabel = buildEvidenceLabel(suggestion);
  const kind = inferKind(suggestion);

  return {
    kind,
    name: buildSuggestedName(sourceLabel, evidenceLabel, kind),
    sourceLabel,
    evidenceLabel,
    confidenceLabel: toConfidenceLabel(suggestion),
    occurrences: suggestion.occurrences,
  };
}

export function rankSuggestedFinancialAccounts(
  accounts: readonly FinancialAccountRow[],
  suggestion: AccountCreationSuggestion
): readonly RankedSuggestedFinancialAccount[] {
  const draft = buildSuggestedFinancialAccountDraft(suggestion);

  return Array.from(accounts)
    .map((account) => ({
      account,
      score: scoreSuggestedFinancialAccount(account, draft),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(left.account.isDefault) - Number(right.account.isDefault) ||
        left.account.name.localeCompare(right.account.name)
    )
    .map(({ account, score }) => ({
      account,
      isLikelyMatch: score > 0,
    }));
}
