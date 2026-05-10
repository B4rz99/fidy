import type { AnyDb } from "@/shared/db";
import type { ProcessedEmailId, TransactionId } from "@/shared/types/branded";
import { updateProcessedEmailStatusInTransaction } from "./lib/repository";

export function markProcessedEmailReclassifiedAsTransfer(input: {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly transactionId: TransactionId;
}) {
  updateProcessedEmailStatusInTransaction({
    db: input.db,
    id: input.id,
    status: "success",
    transactionId: input.transactionId,
  });
}
