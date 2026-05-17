import { eq } from "drizzle-orm";
import type { RecordTransactionAccepted, RecordTransactionSource } from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db/client";
import type { transactions } from "@/shared/db/schema";
import { transactions as transactionsTable } from "@/shared/db/schema";
import { buildDefaultFinancialAccountId } from "@/shared/lib";
import { normalizeTransactionSource } from "@/shared/lib/transaction-source.public";
import { requireTransactionId } from "@/shared/types/assertions";
import type { FinancialAccountId, IsoDateTime, TransactionId } from "@/shared/types/branded";

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

export function insertTransactionStorageRow(db: AnyDb, row: TransactionStorageWriteRow) {
  db.insert(transactionsTable).values(normalizeTransactionStorageRow(row)).run();
}

export function upsertTransactionStorageRow(db: AnyDb, row: TransactionStorageWriteRow) {
  const normalizedRow = normalizeTransactionStorageRow(row);
  db.insert(transactionsTable)
    .values(normalizedRow)
    .onConflictDoUpdate({
      target: transactionsTable.id,
      set: {
        type: normalizedRow.type,
        amount: normalizedRow.amount,
        categoryId: normalizedRow.categoryId,
        description: normalizedRow.description,
        counterpartyName: normalizedRow.counterpartyName,
        date: normalizedRow.date,
        accountId: normalizedRow.accountId,
        accountAttributionState: normalizedRow.accountAttributionState,
        supersededAt: normalizedRow.supersededAt,
        supersededByTransferId: normalizedRow.supersededByTransferId,
        source: normalizedRow.source,
        updatedAt: normalizedRow.updatedAt,
        voidedAt: normalizedRow.voidedAt,
      },
    })
    .run();
}

export function softDeleteTransactionStorageRow(db: AnyDb, id: TransactionId, now: IsoDateTime) {
  db.update(transactionsTable)
    .set({ voidedAt: now, updatedAt: now })
    .where(eq(transactionsTable.id, id))
    .run();
}

export function markTransactionSupersededStorageRow(
  db: AnyDb,
  input: {
    readonly id: TransactionId;
    readonly supersededAt: IsoDateTime;
    readonly supersededByTransferId?: TransactionStorageRow["supersededByTransferId"] | null;
    readonly updatedAt: IsoDateTime;
  }
) {
  db.update(transactionsTable)
    .set({
      supersededAt: input.supersededAt,
      supersededByTransferId: input.supersededByTransferId ?? null,
      updatedAt: input.updatedAt,
    })
    .where(eq(transactionsTable.id, input.id))
    .run();
}
