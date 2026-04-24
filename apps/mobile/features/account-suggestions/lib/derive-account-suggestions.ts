import type { CaptureEvidenceType } from "@/features/capture-evidence/public";

type RepeatedCaptureEvidence = {
  readonly scope: string;
  readonly value: string;
  readonly sourceFamily: string;
  readonly evidenceType: string;
  readonly occurrences: number;
};

type SuggestionEvidenceType = Extract<CaptureEvidenceType, "alias_token" | "card_hint" | "last4">;

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
  return value === "last4" || value === "card_hint" || value === "alias_token";
}

export function createAccountSuggestionFingerprint(scope: string, value: string) {
  return JSON.stringify([scope, value]);
}

function toConfidenceScore(evidenceType: SuggestionEvidenceType, occurrences: number) {
  const baseScore = evidenceType === "last4" ? 100 : evidenceType === "card_hint" ? 80 : 60;

  return baseScore * occurrences;
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
