import type { CaptureEvidenceSeed } from "@/features/capture-evidence/public";
import {
  type FinancialAccountIdentifierRow,
  type FinancialAccountRow,
  getFinancialAccountIdentifiersForUser,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts/public";
import type { AnyDb } from "@/shared/db";
import type { FinancialAccountId, UserId } from "@/shared/types/branded";

type MatchableEvidence = Pick<CaptureEvidenceSeed, "scope" | "value">;

const matchesEvidence = (
  identifier: Pick<FinancialAccountIdentifierRow, "accountId" | "scope" | "value">,
  evidence: MatchableEvidence
) => identifier.scope === evidence.scope && identifier.value === evidence.value;

const matchedAccountIdsForEvidence = (
  identifiers: readonly Pick<FinancialAccountIdentifierRow, "accountId" | "scope" | "value">[],
  evidence: MatchableEvidence
) =>
  identifiers.flatMap((identifier) =>
    matchesEvidence(identifier, evidence) ? [identifier.accountId] : []
  );

export function matchFinancialAccountId(
  identifiers: readonly Pick<FinancialAccountIdentifierRow, "accountId" | "scope" | "value">[],
  evidence: readonly MatchableEvidence[]
): FinancialAccountId | null {
  const matchedAccountIds = Array.from(
    new Set(evidence.flatMap((row) => matchedAccountIdsForEvidence(identifiers, row)))
  );

  return matchedAccountIds.length === 1 ? (matchedAccountIds[0] ?? null) : null;
}

function filterIdentifiersForActiveAccounts(
  identifiers: readonly Pick<FinancialAccountIdentifierRow, "accountId" | "scope" | "value">[],
  accounts: readonly Pick<FinancialAccountRow, "id">[]
) {
  const activeAccountIds = new Set(accounts.map((account) => account.id));

  return identifiers.filter((identifier) => activeAccountIds.has(identifier.accountId));
}

export function findMatchingFinancialAccountId(
  db: AnyDb,
  userId: UserId,
  evidence: readonly MatchableEvidence[]
) {
  return matchFinancialAccountId(
    filterIdentifiersForActiveAccounts(
      getFinancialAccountIdentifiersForUser(db, userId),
      getFinancialAccountsForUser(db, userId)
    ),
    evidence
  );
}
