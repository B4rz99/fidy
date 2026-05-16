import type { AnyDb } from "@/shared/db";
import type { ProcessedSourceEventId, TransactionId, UserId } from "@/shared/types/branded";
import { updateProcessedSourceEventStatusInTransaction } from "./lib/repository";

export function markProcessedSourceEventReclassifiedAsTransfer(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly userId: UserId;
  readonly transactionId: TransactionId;
}) {
  updateProcessedSourceEventStatusInTransaction({
    db: input.db,
    id: input.id,
    userId: input.userId,
    status: "processed",
    transactionId: input.transactionId,
  });
}
