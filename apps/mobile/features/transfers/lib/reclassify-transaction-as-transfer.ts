import { relinkCaptureEvidenceToTransfer } from "@/features/capture-evidence/public";
import {
  markProcessedEmailReclassifiedAsTransfer,
  markProcessedSourceEventReclassifiedAsTransfer,
} from "@/features/email-capture/transfer-reclassification.public";
import {
  getTransactionById,
  markTransactionSuperseded,
} from "@/features/transactions/transfer-reclassification.public";
import { generateTransferId, toIsoDateTime } from "@/shared/lib.public";
import type {
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  ReviewCandidateId,
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
  readonly processedSourceEventId?: ProcessedSourceEventId;
  readonly reviewCandidateId?: ReviewCandidateId;
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
  readonly saveTransactionRow?: typeof markTransactionSuperseded;
  readonly relinkEvidenceToTransfer?: typeof relinkCaptureEvidenceToTransfer;
  readonly saveProcessedEmailStatus?: typeof markProcessedEmailReclassifiedAsTransfer;
  readonly saveProcessedSourceEventStatus?: typeof markProcessedSourceEventReclassifiedAsTransfer;
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
    saveTransactionRow = markTransactionSuperseded,
    relinkEvidenceToTransfer = relinkCaptureEvidenceToTransfer,
    saveProcessedEmailStatus = markProcessedEmailReclassifiedAsTransfer,
    saveProcessedSourceEventStatus = markProcessedSourceEventReclassifiedAsTransfer,
  }: ReclassifyTransactionAsTransferDeps = {}
): ReclassifyTransactionAsTransferResult {
  const existingTransaction = loadTransactionById(db, input.transactionId);

  if (
    existingTransaction == null ||
    existingTransaction.userId !== input.userId ||
    existingTransaction.voidedAt != null ||
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
    source: "capture-match",
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
      supersededByTransferId: built.transfer.id,
      updatedAt,
    });

    relinkEvidenceToTransfer(tx, {
      transactionId: existingTransaction.id,
      transferId: built.transfer.id,
      updatedAt,
    });

    if (input.processedSourceEventId && input.reviewCandidateId) {
      saveProcessedSourceEventStatus({
        db: tx,
        id: input.processedSourceEventId,
        userId: input.userId,
        reviewCandidateId: input.reviewCandidateId,
        transactionId: existingTransaction.id,
        updatedAt,
      });
    } else if (input.processedEmailId) {
      saveProcessedEmailStatus({
        db: tx,
        id: input.processedEmailId,
        transactionId: existingTransaction.id,
      });
    }
  });

  return {
    success: true,
    transfer: built.transfer,
  };
}
