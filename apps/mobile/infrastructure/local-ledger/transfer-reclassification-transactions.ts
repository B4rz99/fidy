import { eq } from "drizzle-orm";
import type { ReclassifiableTransaction } from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { transactions } from "@/shared/db/schema";
import type { IsoDateTime, TransactionId, TransferId } from "@/shared/types/branded";
import { markTransactionSupersededStorageRow } from "./transaction-storage";

export type ReclassificationTransactionRow = typeof transactions.$inferSelect;

export function getReclassificationTransactionById(
  db: AnyDb,
  id: TransactionId
): ReclassificationTransactionRow | null {
  const rows = db.select().from(transactions).where(eq(transactions.id, id)).all();
  return rows[0] ?? null;
}

export function markReclassificationTransactionSuperseded(
  db: AnyDb,
  input: {
    readonly id: TransactionId;
    readonly supersededAt: IsoDateTime;
    readonly supersededByTransferId?: TransferId | null;
    readonly updatedAt: IsoDateTime;
  }
) {
  const transaction = getReclassificationTransactionById(db, input.id);
  if (transaction == null) {
    throw new Error("Reclassification source transaction was not found");
  }

  markTransactionSupersededStorageRow(db, {
    id: transaction.id,
    supersededAt: input.supersededAt,
    supersededByTransferId: input.supersededByTransferId ?? null,
    updatedAt: input.updatedAt,
  });
}

export const toReclassifiableTransaction = (
  transaction: ReclassificationTransactionRow | null
): ReclassifiableTransaction | null =>
  transaction === null || (transaction.type !== "expense" && transaction.type !== "income")
    ? null
    : {
        id: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        accountId: transaction.accountId ?? null,
        accountAttributionState:
          transaction.accountAttributionState === "confirmed" ||
          transaction.accountAttributionState === "inferred"
            ? transaction.accountAttributionState
            : "unresolved",
        date: transaction.date,
        voidedAt: transaction.voidedAt ?? null,
        supersededAt: transaction.supersededAt ?? null,
      };
