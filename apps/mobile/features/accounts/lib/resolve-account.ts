import type { AccountId } from "@/shared/types/branded";
import type { StoredAccount } from "../schema";

type Candidate = Pick<StoredAccount, "id" | "identifiers">;

export function resolveAccountId(
  candidates: readonly Candidate[],
  extractedIdentifier: string | null
): AccountId | "review" {
  if (candidates.length === 0) return "review";

  if (extractedIdentifier === null) {
    return candidates.length === 1 ? candidates[0].id : "review";
  }

  const lower = extractedIdentifier.toLowerCase();
  const matches = candidates.filter((c) => c.identifiers.some((id) => id.toLowerCase() === lower));

  if (matches.length === 1) return matches[0].id;
  return "review";
}
