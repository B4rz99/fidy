import { Effect } from "effect";
import type { RecordAutomatedTransactionInput } from "@/infrastructure/local-ledger/record-transaction";
import { fromPromise } from "@/shared/effect/runtime";
import { requireCopAmount, requireIsoDate } from "@/shared/types/assertions";
import { EmailPipelineDeps } from "./runtime";
import { getParsedCounterpartyName } from "./shared";
import type { CreateEmailPipelineServiceDeps, PersistedTransactionContext } from "./types";

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

export const recordTransactionWithLocalLedger = async (
  context: PersistedTransactionContext,
  input: {
    readonly recordAutomatedTransactionWithLocalLedger: CreateEmailPipelineServiceDeps["recordAutomatedTransactionWithLocalLedger"];
    readonly db: PersistedTransactionContext["db"];
  }
) => {
  const result = await input.recordAutomatedTransactionWithLocalLedger({
    db: input.db,
    command: buildAutomatedTransactionCommand(context),
    transactionId: context.txId,
    now: context.now,
  });
  if (!result.success) throw new Error(`RecordTransaction rejected: ${result.error}`);
};

export function persistTransactionRecordEffect(context: PersistedTransactionContext) {
  return Effect.gen(function* () {
    const { recordAutomatedTransactionWithLocalLedger } = yield* EmailPipelineDeps.tag;
    yield* fromPromise(() =>
      recordTransactionWithLocalLedger(context, {
        recordAutomatedTransactionWithLocalLedger,
        db: context.db,
      })
    );
  });
}
