import type { CaptureEvidenceSeed } from "@/features/capture-evidence";
import {
  type FinancialAccountIdentifierRow,
  type FinancialAccountRow,
  getFinancialAccountIdentifiersForUser,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts";
import type { AnyDb } from "@/shared/db";
import type { FinancialAccountId, UserId } from "@/shared/types/branded";

type MatchableEvidence = Pick<CaptureEvidenceSeed, "scope" | "value">;

export function matchFinancialAccountId(
  identifiers: readonly Pick<FinancialAccountIdentifierRow, "accountId" | "scope" | "value">[],
  evidence: readonly MatchableEvidence[]
): FinancialAccountId | null {
  const matchedAccountIds = Array.from(
    new Set(
      evidence.flatMap((row) =>
        identifiers
          .filter((identifier) => identifier.scope === row.scope && identifier.value === row.value)
          .map((identifier) => identifier.accountId)
      )
    )
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
