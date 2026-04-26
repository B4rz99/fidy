import { relinkCaptureEvidenceToTransfer } from "@/features/capture-evidence/public";
import { updateProcessedEmailStatusInTransaction } from "@/features/email-capture/lib/repository";
import { getTransactionById, upsertTransaction } from "@/features/transactions/lib/repository";
import { toIsoDateTime } from "@/shared/lib/format-date";
import { generateTransferId } from "@/shared/lib/generate-id";
import type {
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";
import {
  buildTransfer,
  type StoredTransfer,
  type TransferBuildError,
  type TransferSide,
  toTransferRow,
} from "./build-transfer";
import type { TransferRow } from "./repository";
import { saveTransfer } from "./repository";

type ReclassifyTransactionAsTransferInput = {
  readonly userId: UserId;
  readonly transactionId: TransactionId;
  readonly processedEmailId?: ProcessedEmailId;
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly toSide: TransferSide | null;
  readonly description: string;
  readonly date: Date;
};

type ReclassifyTransactionAsTransferDeps = {
  readonly now?: () => Date;
  readonly createId?: () => TransferId;
  readonly saveTransferRow?: (db: Parameters<typeof saveTransfer>[0], row: TransferRow) => void;
  readonly loadTransactionById?: typeof getTransactionById;
  readonly saveTransactionRow?: typeof upsertTransaction;
  readonly relinkEvidenceToTransfer?: typeof relinkCaptureEvidenceToTransfer;
  readonly saveProcessedEmailStatus?: typeof updateProcessedEmailStatusInTransaction;
};

export type ReclassifyTransactionAsTransferError = TransferBuildError | "transactionNotFound";

export type ReclassifyTransactionAsTransferResult =
  | { success: true; transfer: StoredTransfer }
  | { success: false; error: ReclassifyTransactionAsTransferError };

export function reclassifyTransactionAsTransfer(
  db: Parameters<typeof saveTransfer>[0],
  input: ReclassifyTransactionAsTransferInput,
  {
    now = () => new Date(),
    createId = generateTransferId,
    saveTransferRow = saveTransfer,
    loadTransactionById = getTransactionById,
    saveTransactionRow = upsertTransaction,
    relinkEvidenceToTransfer = relinkCaptureEvidenceToTransfer,
    saveProcessedEmailStatus = updateProcessedEmailStatusInTransaction,
  }: ReclassifyTransactionAsTransferDeps = {}
): ReclassifyTransactionAsTransferResult {
  const existingTransaction = loadTransactionById(db, input.transactionId);

  if (
    existingTransaction == null ||
    existingTransaction.userId !== input.userId ||
    existingTransaction.deletedAt != null ||
    existingTransaction.supersededAt != null
  ) {
    return { success: false, error: "transactionNotFound" };
  }

  const nowDate = now();
  const built = buildTransfer({
    input: {
      digits: input.digits,
      fromSide: input.fromSide,
      toSide: input.toSide,
      description: input.description,
      date: input.date,
    },
    userId: input.userId,
    id: createId(),
    now: nowDate,
  });

  if (!built.success) {
    return built;
  }

  const updatedAt = toIsoDateTime(nowDate) as IsoDateTime;

  db.transaction((tx) => {
    saveTransferRow(tx, toTransferRow(built.transfer));

    saveTransactionRow(tx, {
      ...existingTransaction,
      supersededAt: updatedAt,
      updatedAt,
    });

    relinkEvidenceToTransfer(tx, {
      transactionId: existingTransaction.id,
      transferId: built.transfer.id,
      updatedAt,
    });

    if (input.processedEmailId) {
      saveProcessedEmailStatus({
        db: tx,
        id: input.processedEmailId,
        status: "success",
        transactionId: existingTransaction.id,
      });
    }
  });

  return {
    success: true,
    transfer: built.transfer,
  };
}
