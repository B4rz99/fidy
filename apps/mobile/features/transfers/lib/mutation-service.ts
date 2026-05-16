import type { LocalLedgerTransfer } from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { parseIsoDate } from "@/shared/lib/format-date";
import { generateTransferId } from "@/shared/lib/generate-id";
import { captureError } from "@/shared/lib/sentry";
import type { TransferId, UserId } from "@/shared/types/branded";
import type { BuildTransferInput, StoredTransfer } from "./build-transfer";

export type TransferFormInput = {
  readonly digits: BuildTransferInput["digits"];
  readonly fromSide: BuildTransferInput["fromSide"];
  readonly toSide: BuildTransferInput["toSide"];
  readonly description: BuildTransferInput["description"];
  readonly date: BuildTransferInput["date"];
};

export type TransferMutationError =
  | "amountRequired"
  | "amountNotPositive"
  | "distinctSidesRequired"
  | "fromSideRequired"
  | "toSideRequired"
  | "trackedAccountRequired"
  | "storeNotInitialized"
  | "saveFailed"
  | "accountNotUsable"
  | "futureDated"
  | "externalLabelRequired";

export type TransferMutationResult =
  | { success: true; transfer: StoredTransfer }
  | { success: false; error: TransferMutationError };

type CreateTransferMutationServiceDeps = {
  readonly getDb: () => AnyDb | null;
  readonly getUserId: () => UserId | null;
  readonly refresh: () => Promise<void>;
  readonly recordTransfer: (input: {
    readonly db: AnyDb;
    readonly userId: UserId;
    readonly transferId: TransferId;
    readonly input: TransferFormInput;
    readonly now: Date;
  }) => Promise<
    | { success: true; transfer: LocalLedgerTransfer }
    | { success: false; error: TransferMutationError }
  >;
  readonly now?: () => Date;
  readonly createId?: () => TransferId;
};

function toStoredTransfer(transfer: LocalLedgerTransfer): StoredTransfer {
  return {
    id: transfer.id,
    userId: transfer.userId,
    amount: transfer.amount,
    fromSide: transfer.fromSide,
    toSide: transfer.toSide,
    description: transfer.description,
    date: parseIsoDate(transfer.date),
    createdAt: new Date(transfer.createdAt),
    updatedAt: new Date(transfer.updatedAt),
    deletedAt: transfer.voidedAt == null ? null : new Date(transfer.voidedAt),
  };
}

export function createTransferMutationService({
  getDb,
  getUserId,
  refresh,
  recordTransfer,
  now = () => new Date(),
  createId = generateTransferId,
}: CreateTransferMutationServiceDeps) {
  return {
    save: async (input: TransferFormInput): Promise<TransferMutationResult> => {
      const db = getDb();
      const userId = getUserId();

      if (!db || !userId) {
        return { success: false, error: "storeNotInitialized" };
      }

      const transferId = createId();
      const currentTime = now();

      let result:
        | { success: true; transfer: LocalLedgerTransfer }
        | { success: false; error: TransferMutationError };
      try {
        result = await recordTransfer({
          db,
          userId,
          transferId,
          input,
          now: currentTime,
        });
      } catch (error) {
        captureError(error);
        return { success: false, error: "saveFailed" };
      }
      if (!result.success) return result;

      try {
        await refresh();
      } catch {
        // Keep the persisted transfer successful even if the caller refresh fails.
      }

      return { success: true, transfer: toStoredTransfer(result.transfer) };
    },
  };
}
