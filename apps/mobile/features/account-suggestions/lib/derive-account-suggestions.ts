import type { CaptureEvidenceType } from "@/features/capture-evidence/public";

type RepeatedCaptureEvidence = {
  readonly scope: string;
  readonly value: string;
  readonly sourceFamily: string;
  readonly evidenceType: string;
  readonly occurrences: number;
};

type SuggestionEvidenceType = Extract<
  CaptureEvidenceType,
  "alias_token" | "card_hint" | "last4" | "llm_account_hint"
>;

export type AccountCreationSuggestion = {
  readonly fingerprint: string;
  readonly scope: string;
  readonly value: string;
  readonly sourceFamily: string;
  readonly evidenceType: SuggestionEvidenceType;
  readonly occurrences: number;
  readonly confidenceScore: number;
};

function isSuggestionEvidenceType(value: string): value is SuggestionEvidenceType {
  return (
    value === "last4" ||
    value === "card_hint" ||
    value === "alias_token" ||
    value === "llm_account_hint"
  );
}

export function createAccountSuggestionFingerprint(scope: string, value: string) {
  return JSON.stringify([scope, value]);
}

function toConfidenceScore(evidenceType: SuggestionEvidenceType, occurrences: number) {
  const baseScore = (() => {
    if (evidenceType === "last4") return 100;
    if (evidenceType === "llm_account_hint") return 90;
    if (evidenceType === "card_hint") return 80;
    return 60;
  })();

  return baseScore * occurrences;
}

function hasStrongerSameSourceEvidence(
  row: RepeatedCaptureEvidence & { readonly evidenceType: SuggestionEvidenceType },
  rows: readonly (RepeatedCaptureEvidence & { readonly evidenceType: SuggestionEvidenceType })[]
) {
  return (
    (row.evidenceType === "alias_token" || row.evidenceType === "llm_account_hint") &&
    rows.some(
      (candidate) =>
        candidate.sourceFamily === row.sourceFamily &&
        candidate.evidenceType !== row.evidenceType &&
        (candidate.evidenceType === "last4" || candidate.evidenceType === "card_hint")
    )
  );
}

function compareSuggestions(left: AccountCreationSuggestion, right: AccountCreationSuggestion) {
  return (
    right.confidenceScore - left.confidenceScore ||
    right.occurrences - left.occurrences ||
    left.scope.localeCompare(right.scope) ||
    left.value.localeCompare(right.value)
  );
}

export function deriveAccountSuggestions(
  rows: readonly RepeatedCaptureEvidence[]
): readonly AccountCreationSuggestion[] {
  const suggestionRows = Array.from(rows).filter(
    (
      row
    ): row is RepeatedCaptureEvidence & {
      readonly evidenceType: SuggestionEvidenceType;
    } => isSuggestionEvidenceType(row.evidenceType)
  );

  return suggestionRows
    .filter((row) => !hasStrongerSameSourceEvidence(row, suggestionRows))
    .map((row) => ({
      fingerprint: createAccountSuggestionFingerprint(row.scope, row.value),
      scope: row.scope,
      value: row.value,
      sourceFamily: row.sourceFamily,
      evidenceType: row.evidenceType,
      occurrences: row.occurrences,
      confidenceScore: toConfidenceScore(row.evidenceType, row.occurrences),
    }))
    .sort(compareSuggestions);
}
