import type { RecordAutomatedTransactionInput } from "@/infrastructure/local-ledger/public";
import { requireCopAmount, requireIsoDate } from "@/shared/types/assertions";
import { getParsedCounterpartyName } from "./shared";
import type { PersistedTransactionContext } from "./types";

export const buildAutomatedTransactionCommand = (
  context: PersistedTransactionContext
): RecordAutomatedTransactionInput["command"] => ({
  userId: context.userId,
  type: context.parsed.type,
  amount: requireCopAmount(context.parsed.amount),
  accountId: context.defaultAccount.id,
  accountAttributionState: "unresolved",
  categoryId: context.categoryId,
  occurredOn: requireIsoDate(context.parsed.date),
  description: null,
  counterpartyName: getParsedCounterpartyName(context.parsed),
  source: "email_capture",
});
