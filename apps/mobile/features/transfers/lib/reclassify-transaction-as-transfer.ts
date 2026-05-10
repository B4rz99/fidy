import { relinkCaptureEvidenceToTransfer } from "@/features/capture-evidence/public";
import { markProcessedEmailReclassifiedAsTransfer } from "@/features/email-capture/transfer-reclassification.public";
import {
  getTransactionById,
  markTransactionSuperseded,
} from "@/features/transactions/transfer-reclassification.public";
import { generateTransferId, toIsoDateTime } from "@/shared/lib.public";
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
  readonly saveTransactionRow?: typeof markTransactionSuperseded;
  readonly relinkEvidenceToTransfer?: typeof relinkCaptureEvidenceToTransfer;
  readonly saveProcessedEmailStatus?: typeof markProcessedEmailReclassifiedAsTransfer;
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
        transactionId: existingTransaction.id,
      });
    }
  });

  return {
    success: true,
    transfer: built.transfer,
  };
}
