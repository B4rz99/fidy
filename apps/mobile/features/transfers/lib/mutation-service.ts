import type { AnyDb } from "@/shared/db";
import { generateTransferId } from "@/shared/lib/generate-id";
import type { TransferId, UserId } from "@/shared/types/branded";
import {
  buildTransfer,
  type StoredTransfer,
  type TransferBuildError,
  toTransferRow,
} from "./build-transfer";
import type { TransferRow } from "./repository";

export type TransferFormInput = {
  readonly digits: string;
  readonly fromSide: Parameters<typeof buildTransfer>[0]["fromSide"];
  readonly toSide: Parameters<typeof buildTransfer>[0]["toSide"];
  readonly description: string;
  readonly date: Date;
};

export type TransferMutationError = TransferBuildError | "storeNotInitialized" | "saveFailed";

export type TransferMutationResult =
  | { success: true; transfer: StoredTransfer }
  | { success: false; error: TransferMutationError };

type CreateTransferMutationServiceDeps = {
  readonly getDb: () => AnyDb | null;
  readonly getUserId: () => UserId | null;
  readonly refresh: () => Promise<void>;
  readonly saveTransferRow: (db: AnyDb, row: TransferRow) => void;
  readonly now?: () => Date;
  readonly createId?: () => TransferId;
};

export function createTransferMutationService({
  getDb,
  getUserId,
  refresh,
  saveTransferRow,
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

      const built = buildTransfer(input, userId, createId(), now());
      if (!built.success) {
        return built;
      }

      try {
        saveTransferRow(db, toTransferRow(built.transfer));
      } catch {
        return { success: false, error: "saveFailed" };
      }

      try {
        await refresh();
      } catch {
        // Keep the persisted transfer successful even if the caller refresh fails.
      }

      return { success: true, transfer: built.transfer };
    },
  };
}
