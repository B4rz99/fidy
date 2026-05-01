import type { AccountCreationSuggestion } from "../lib/derive-account-suggestions";

type DiagnosticsInput = {
  readonly limit?: number;
  readonly minimumOccurrences?: number;
};

type EvidenceGroup = {
  readonly scope: string;
  readonly sourceFamily: string;
  readonly evidenceType: string;
  readonly occurrences: number;
};

export function logAccountSuggestionDiagnostics(
  suggestions: readonly AccountCreationSuggestion[],
  input: DiagnosticsInput,
  evidenceGroups: readonly EvidenceGroup[]
) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;

  console.info("[account-suggestions] evidence_groups", {
    totalCount: evidenceGroups.length,
    minimumOccurrences: 1,
    groups: evidenceGroups.map((group) => ({
      scope: group.scope,
      sourceFamily: group.sourceFamily,
      evidenceType: group.evidenceType,
      occurrences: group.occurrences,
    })),
  });
  console.info("[account-suggestions] candidates", {
    totalCount: suggestions.length,
    returnedCount: input.limit ? Math.min(input.limit, suggestions.length) : suggestions.length,
    limit: input.limit ?? null,
    minimumOccurrences: input.minimumOccurrences ?? 2,
    candidates: suggestions.map((suggestion) => ({
      fingerprint: suggestion.fingerprint,
      scope: suggestion.scope,
      value: suggestion.value,
      sourceFamily: suggestion.sourceFamily,
      evidenceType: suggestion.evidenceType,
      occurrences: suggestion.occurrences,
      confidenceScore: suggestion.confidenceScore,
    })),
  });
}
