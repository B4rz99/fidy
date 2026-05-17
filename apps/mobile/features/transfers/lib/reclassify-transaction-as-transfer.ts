import {
  reclassifyTransactionAsTransfer as reclassifyTransactionWithLocalLedger,
  type ReclassifyTransactionAsTransferError as LocalLedgerReclassificationError,
} from "@/infrastructure/local-ledger/public";
import type { LocalLedgerTransfer } from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { generateTransferId } from "@/shared/lib.public";
import type {
  IsoDateTime,
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
} from "./build-transfer";

type ReclassifyTransactionAsTransferInput = {
  readonly userId: UserId;
  readonly transactionId: TransactionId;
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
};

export type ReclassifyTransactionAsTransferError =
  | TransferBuildError
  | LocalLedgerReclassificationError;

export type ReclassifyTransactionAsTransferResult =
  | { success: true; transfer: StoredTransfer }
  | { success: false; error: ReclassifyTransactionAsTransferError };

const toLocalLedgerTransfer = (transfer: StoredTransfer): LocalLedgerTransfer => ({
  id: transfer.id,
  userId: transfer.userId,
  amount: transfer.amount,
  fromSide: transfer.fromSide,
  toSide: transfer.toSide,
  description: transfer.description,
  date: toIsoDate(transfer.date),
  createdAt: toIsoDateTime(transfer.createdAt),
  updatedAt: toIsoDateTime(transfer.updatedAt),
  voidedAt: transfer.deletedAt ? toIsoDateTime(transfer.deletedAt) : null,
  source: transfer.source,
});

export function reclassifyTransactionAsTransfer(
  db: AnyDb,
  input: ReclassifyTransactionAsTransferInput,
  {
    now = () => new Date(),
    createId = generateTransferId,
  }: ReclassifyTransactionAsTransferDeps = {}
): ReclassifyTransactionAsTransferResult {
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

  if (!built.success) return built;

  const updatedAt = toIsoDateTime(nowDate) as IsoDateTime;
  const result = reclassifyTransactionWithLocalLedger(db, {
    userId: input.userId,
    transactionId: input.transactionId,
    processedSourceEventId: input.processedSourceEventId,
    reviewCandidateId: input.reviewCandidateId,
    transfer: toLocalLedgerTransfer(built.transfer),
    updatedAt,
  });

  return result.success ? { success: true, transfer: built.transfer } : result;
}
