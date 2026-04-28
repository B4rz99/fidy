import type {
  FinancialAccountKind,
  FinancialAccountRow,
} from "@/features/financial-accounts/public";
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
const DIRECT_KIND_BY_EVIDENCE_TYPE = new Map<
  AccountCreationSuggestion["evidenceType"],
  FinancialAccountKind
>([["card_hint", "credit_card"]]);
const CONFIDENCE_LABEL_BY_EVIDENCE_TYPE = new Map<
  AccountCreationSuggestion["evidenceType"],
  SuggestedFinancialAccountDraft["confidenceLabel"]
>([
  ["last4", "HIGH"],
  ["llm_account_hint", "HIGH"],
]);
const LLM_HINT_KIND_TERMS: readonly {
  readonly kind: FinancialAccountKind;
  readonly terms: readonly string[];
}[] = [
  {
    kind: "credit_card",
    terms: ["credito", "crédito", "credit", "tarjeta", "card", "visa", "mastercard", "amex"],
  },
  { kind: "savings", terms: ["ahorros", "savings"] },
];

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

function containsAnyTerm(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

function buildEvidenceLabel(suggestion: AccountCreationSuggestion) {
  return suggestion.evidenceType === "last4" ? `••${suggestion.value}` : suggestion.value;
}

function isWalletAliasSuggestion(suggestion: AccountCreationSuggestion) {
  return (
    suggestion.evidenceType === "alias_token" &&
    (WALLET_SOURCE_FAMILIES.has(suggestion.sourceFamily) ||
      normalizeSearchText(suggestion.value).includes("wallet"))
  );
}

const inferLlmHintKind = (value: string): FinancialAccountKind | undefined =>
  LLM_HINT_KIND_TERMS.find((entry) => containsAnyTerm(normalizeSearchText(value), entry.terms))
    ?.kind;

const inferLlmSuggestionKind = (
  suggestion: AccountCreationSuggestion
): FinancialAccountKind | undefined =>
  suggestion.evidenceType === "llm_account_hint"
    ? (inferLlmHintKind(suggestion.value) ?? "checking")
    : undefined;

const inferWalletSuggestionKind = (
  suggestion: AccountCreationSuggestion
): FinancialAccountKind | undefined => (isWalletAliasSuggestion(suggestion) ? "wallet" : undefined);

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

function getKindScore(account: FinancialAccountRow, draft: SuggestedFinancialAccountDraft) {
  return account.kind === draft.kind ? 4 : 0;
}

function getSourceScore(normalizedName: string, normalizedSource: string) {
  return normalizedName.includes(normalizedSource) ? 2 : 0;
}

function getEvidenceScore(normalizedName: string, normalizedEvidence: string) {
  return normalizedEvidence.length > 0 && normalizedName.includes(normalizedEvidence) ? 1 : 0;
}

function getDefaultPenalty(account: FinancialAccountRow) {
  return account.isDefault ? -1 : 0;
}

function scoreSuggestedFinancialAccount(
  account: FinancialAccountRow,
  draft: SuggestedFinancialAccountDraft
) {
  const normalizedName = normalizeSearchText(account.name);
  const normalizedSource = normalizeSearchText(draft.sourceLabel);
  const normalizedEvidence = normalizeSearchText(draft.evidenceLabel.replaceAll("•", ""));

  return [
    getKindScore(account, draft),
    getSourceScore(normalizedName, normalizedSource),
    getEvidenceScore(normalizedName, normalizedEvidence),
    getDefaultPenalty(account),
  ].reduce((total, score) => total + score, 0);
}

export function buildSuggestedFinancialAccountDraft(
  suggestion: AccountCreationSuggestion
): SuggestedFinancialAccountDraft {
  const sourceLabel = normalizeLabel(suggestion.sourceFamily);
  const evidenceLabel = buildEvidenceLabel(suggestion);
  const kind =
    DIRECT_KIND_BY_EVIDENCE_TYPE.get(suggestion.evidenceType) ??
    inferLlmSuggestionKind(suggestion) ??
    inferWalletSuggestionKind(suggestion) ??
    "checking";

  return {
    kind,
    name: buildSuggestedName(sourceLabel, evidenceLabel, kind),
    sourceLabel,
    evidenceLabel,
    confidenceLabel: CONFIDENCE_LABEL_BY_EVIDENCE_TYPE.get(suggestion.evidenceType) ?? "MED",
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
