import type { AnyDb } from "@/shared/db";
import type { IsoDateTime, TransactionId } from "@/shared/types/branded";
import { getTransactionById, upsertTransaction } from "./lib/repository";

export { getTransactionById };

export function markTransactionSuperseded(
  db: AnyDb,
  input: {
    readonly id: TransactionId;
    readonly supersededAt: IsoDateTime;
    readonly updatedAt: IsoDateTime;
  }
) {
  const transaction = getTransactionById(db, input.id);
  if (transaction == null) return;

  upsertTransaction(db, {
    ...transaction,
    supersededAt: input.supersededAt,
    updatedAt: input.updatedAt,
  });
}
