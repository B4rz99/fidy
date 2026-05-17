import type { AnyDb } from "@/shared/db";
import type { IsoDateTime, TransactionId, TransferId } from "@/shared/types/branded";
import { getTransactionById } from "./lib/repository";
import { markReclassificationTransactionSuperseded } from "@/infrastructure/local-ledger/public";

export { getTransactionById };

export function markTransactionSuperseded(
  db: AnyDb,
  input: {
    readonly id: TransactionId;
    readonly supersededAt: IsoDateTime;
    readonly supersededByTransferId?: TransferId | null;
    readonly updatedAt: IsoDateTime;
  }
) {
  markReclassificationTransactionSuperseded(db, input);
}
