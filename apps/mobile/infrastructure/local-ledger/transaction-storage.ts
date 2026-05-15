import type { RecordTransactionAccepted, RecordTransactionSource } from "@/local-ledger/public";
import type { transactions } from "@/shared/db/schema";
import { buildDefaultFinancialAccountId } from "@/shared/lib/default-financial-account-id";
import { normalizeTransactionSource } from "@/shared/lib/transaction-source";
import { requireTransactionId } from "@/shared/types/assertions";
import type { FinancialAccountId, IsoDateTime } from "@/shared/types/branded";

type TransactionStorageRow = typeof transactions.$inferInsert;

export type TransactionStorageWriteRow = Omit<
  TransactionStorageRow,
  | "accountId"
  | "accountAttributionState"
  | "counterpartyName"
  | "supersededAt"
  | "supersededByTransferId"
> & {
  readonly accountId?: FinancialAccountId;
  readonly accountAttributionState?: string;
  readonly counterpartyName?: string | null;
  readonly supersededAt?: IsoDateTime | null;
  readonly supersededByTransferId?: TransactionStorageRow["supersededByTransferId"] | null;
};

type TransactionStorageInput = {
  readonly transaction: RecordTransactionAccepted;
  readonly now: IsoDateTime;
};

const toClosedSource = (source: RecordTransactionSource): RecordTransactionSource => source;

const toStorageSource = (source: string | null | undefined): RecordTransactionSource =>
  normalizeTransactionSource(source);

const defaultAccountAttributionState = (source: RecordTransactionSource): string =>
  source === "manual" ? "confirmed" : "unresolved";

const toStorageAccountDefaults = (
  row: TransactionStorageWriteRow,
  source: RecordTransactionSource
) => ({
  source,
  accountId: row.accountId ?? buildDefaultFinancialAccountId(row.userId),
  accountAttributionState: row.accountAttributionState ?? defaultAccountAttributionState(source),
});

const toStorageLifecycleDefaults = (row: TransactionStorageWriteRow) => ({
  counterpartyName: row.counterpartyName ?? null,
  supersededAt: row.supersededAt ?? null,
  supersededByTransferId: row.supersededByTransferId ?? null,
});

export const normalizeTransactionStorageRow = (
  row: TransactionStorageWriteRow
): TransactionStorageRow => {
  const source = toStorageSource(row.source);
  return {
    ...row,
    ...toStorageAccountDefaults(row, source),
    ...toStorageLifecycleDefaults(row),
  };
};

export const toTransactionStorageRow = ({
  transaction,
  now,
}: TransactionStorageInput): TransactionStorageRow => ({
  id: requireTransactionId(transaction.id),
  userId: transaction.userId,
  type: transaction.type,
  amount: transaction.amount,
  accountId: transaction.accountId,
  accountAttributionState: transaction.accountAttributionState,
  categoryId: transaction.categoryId,
  description: transaction.description === "" ? null : transaction.description,
  counterpartyName: transaction.counterpartyName === "" ? null : transaction.counterpartyName,
  date: transaction.occurredOn,
  createdAt: now,
  updatedAt: now,
  voidedAt: null,
  supersededAt: null,
  supersededByTransferId: null,
  source: toClosedSource(transaction.source),
});
