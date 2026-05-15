import { Effect } from "effect";
import type { TransactionRow } from "@/features/transactions/lib/repository";
import {
  recordTransaction as defaultRecordTransaction,
  type LocalLedgerEntryId,
  type RecordTransactionAccepted,
} from "@/local-ledger/public";
import { fromPromise } from "@/shared/effect/runtime";
import { requireCopAmount, requireIsoDate, requireTransactionId } from "@/shared/types/assertions";
import { EmailPipelineDeps } from "./runtime";
import { getParsedCounterpartyName } from "./shared";
import type { CreateEmailPipelineServiceDeps, PersistedTransactionContext } from "./types";

const buildTransactionRow = (
  context: PersistedTransactionContext,
  transaction: RecordTransactionAccepted
): TransactionRow => ({
  id: requireTransactionId(transaction.id),
  userId: transaction.userId,
  type: transaction.type,
  amount: transaction.amount,
  categoryId: transaction.categoryId,
  description: transaction.description === "" ? null : transaction.description,
  counterpartyName: transaction.counterpartyName === "" ? null : transaction.counterpartyName,
  date: transaction.occurredOn,
  accountId: transaction.accountId,
  accountAttributionState: transaction.accountAttributionState,
  source: transaction.source,
  createdAt: context.now,
  updatedAt: context.now,
});

export const recordTransactionToDb = async (
  context: PersistedTransactionContext,
  input: {
    readonly insertTransaction: CreateEmailPipelineServiceDeps["insertTransaction"];
    readonly recordTransaction: NonNullable<CreateEmailPipelineServiceDeps["recordTransaction"]>;
    readonly db: PersistedTransactionContext["db"];
  }
) => {
  const result = await input.recordTransaction({
    command: {
      userId: context.userId,
      type: context.parsed.type,
      amount: requireCopAmount(context.parsed.amount),
      accountId: context.defaultAccount.id,
      accountAttributionState: "unresolved",
      categoryId: context.categoryId,
      occurredOn: requireIsoDate(context.parsed.date),
      description: null,
      counterpartyName: getParsedCounterpartyName(context.parsed),
      source: "automated",
    },
    ports: {
      commit: async (transaction) => {
        await input.insertTransaction(input.db, buildTransactionRow(context, transaction));
        return { ok: true as const, transaction };
      },
      canUseAccount: async () => true,
      canUseCategory: async () => true,
      today: () => requireIsoDate(context.now.slice(0, 10)),
      generateEntryId: () => context.txId as unknown as LocalLedgerEntryId,
    },
  });
  if (!result.ok) throw new Error(`RecordTransaction rejected: ${result.code}`);
};

export function persistTransactionRecordEffect(context: PersistedTransactionContext) {
  return Effect.gen(function* () {
    const { insertTransaction, recordTransaction = defaultRecordTransaction } =
      yield* EmailPipelineDeps.tag;
    yield* fromPromise(() =>
      recordTransactionToDb(context, {
        insertTransaction,
        recordTransaction,
        db: context.db,
      })
    );
  });
}

export { defaultRecordTransaction };
