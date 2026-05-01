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
  | "alias_token"
  | "card_hint"
  | "last4"
  | "llm_account_hint"
  | "card_product_hint"
  | "account_type_hint"
>;

type SuggestionRow = RepeatedCaptureEvidence & { readonly evidenceType: SuggestionEvidenceType };

const SUGGESTION_EVIDENCE_TYPES = new Set<SuggestionEvidenceType>([
  "last4",
  "card_hint",
  "alias_token",
  "llm_account_hint",
  "card_product_hint",
  "account_type_hint",
]);

const BASE_CONFIDENCE_BY_EVIDENCE_TYPE = new Map<SuggestionEvidenceType, number>([
  ["last4", 100],
  ["card_product_hint", 85],
  ["card_hint", 80],
  ["llm_account_hint", 70],
  ["account_type_hint", 50],
  ["alias_token", 60],
]);

const GENERIC_LLM_HINT_TERMS = new Set([
  "account",
  "card",
  "credito",
  "crédito",
  "credit",
  "cuenta",
  "tarjeta",
]);

const ACCOUNT_LIKE_LLM_HINT_TERMS = new Set([
  "account",
  "ahorros",
  "amex",
  "black",
  "card",
  "checking",
  "corriente",
  "credito",
  "credit",
  "cuenta",
  "debito",
  "mastercard",
  "oro",
  "platinum",
  "savings",
  "tarjeta",
  "visa",
]);

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
  return SUGGESTION_EVIDENCE_TYPES.has(value as SuggestionEvidenceType);
}

export function createAccountSuggestionFingerprint(scope: string, value: string) {
  return JSON.stringify([scope, value]);
}

function toConfidenceScore(evidenceType: SuggestionEvidenceType, occurrences: number) {
  const baseScore = BASE_CONFIDENCE_BY_EVIDENCE_TYPE.get(evidenceType) ?? 60;
  return baseScore * occurrences;
}

function normalizeLlmHintToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getHintCanonicalValue(row: SuggestionRow) {
  if (row.evidenceType !== "llm_account_hint" && row.evidenceType !== "card_product_hint") {
    return row.value;
  }

  const sourceTokens = new Set(row.sourceFamily.split(/[_\s-]+/).map(normalizeLlmHintToken));
  const tokens = row.value
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizeLlmHintToken)
    .filter((token) => token.length > 0)
    .filter((token) => !sourceTokens.has(token))
    .filter((token) => !GENERIC_LLM_HINT_TERMS.has(token));

  return tokens.length > 0 ? tokens.join(" ") : normalizeLlmHintToken(row.value);
}

function getNormalizedLlmHintTokens(value: string) {
  return value
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizeLlmHintToken)
    .filter((token) => token.length > 0);
}

function isAccountLikeSuggestionRow(row: SuggestionRow) {
  return (
    row.evidenceType !== "llm_account_hint" ||
    getNormalizedLlmHintTokens(row.value).some((token) => ACCOUNT_LIKE_LLM_HINT_TERMS.has(token))
  );
}

function mergeEquivalentSuggestionRows(rows: readonly SuggestionRow[]): readonly SuggestionRow[] {
  const groupedRows = rows.reduce((groups, row) => {
    const key = JSON.stringify([
      row.scope,
      row.sourceFamily,
      row.evidenceType,
      getHintCanonicalValue(row),
    ]);
    const previous = groups.get(key);
    const merged = previous
      ? {
          ...previous,
          value: previous.occurrences >= row.occurrences ? previous.value : row.value,
          occurrences: previous.occurrences + row.occurrences,
        }
      : row;

    return new Map(groups).set(key, merged);
  }, new Map<string, SuggestionRow>());

  return Array.from(groupedRows.values());
}

function hasStrongerSameSourceEvidence(
  row: RepeatedCaptureEvidence & { readonly evidenceType: SuggestionEvidenceType },
  rows: readonly (RepeatedCaptureEvidence & { readonly evidenceType: SuggestionEvidenceType })[]
) {
  return (
    (row.evidenceType === "alias_token" ||
      row.evidenceType === "llm_account_hint" ||
      row.evidenceType === "account_type_hint" ||
      row.evidenceType === "card_product_hint") &&
    rows.some(
      (candidate) =>
        candidate.sourceFamily === row.sourceFamily &&
        candidate.evidenceType !== row.evidenceType &&
        (candidate.evidenceType === "last4" ||
          candidate.evidenceType === "card_hint" ||
          (row.evidenceType !== "card_product_hint" &&
            candidate.evidenceType === "card_product_hint"))
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

  const accountLikeSuggestionRows = suggestionRows.filter(isAccountLikeSuggestionRow);

  return mergeEquivalentSuggestionRows(accountLikeSuggestionRows)
    .filter((row) => !hasStrongerSameSourceEvidence(row, accountLikeSuggestionRows))
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
