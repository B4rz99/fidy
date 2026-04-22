import type { StoredTransaction } from "@/features/transactions";
import { refreshTransactions } from "@/features/transactions";
import type { TransferSide } from "@/features/transfers/lib/build-transfer";
import type {
  TransferMutationError,
  TransferMutationResult,
} from "@/features/transfers/lib/mutation-service";
import { createTransferMutationService } from "@/features/transfers/lib/mutation-service";
import type {
  ReclassifyTransactionAsTransferError,
  ReclassifyTransactionAsTransferResult,
} from "@/features/transfers/lib/reclassify-transaction-as-transfer";
import { reclassifyTransactionAsTransfer } from "@/features/transfers/lib/reclassify-transaction-as-transfer";
import { saveTransfer } from "@/features/transfers/lib/repository";
import type { AnyDb } from "@/shared/db";
import type { ProcessedEmailId, UserId } from "@/shared/types/branded";

type SubmitTransferFormInput = {
  readonly date: Date;
  readonly db: AnyDb | null;
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly processedEmailId: ProcessedEmailId | null;
  readonly sourceTransaction: StoredTransaction | null;
  readonly toSide: TransferSide | null;
  readonly userId: UserId | null | undefined;
};

export type SubmitTransferFormResult =
  | { success: true; destination: "needs-review" | "tabs" }
  | {
      success: false;
      error: ReclassifyTransactionAsTransferError | TransferMutationError | "saveFailed";
    };

function hasTransferFormContext(
  input: SubmitTransferFormInput
): input is SubmitTransferFormInput & {
  readonly db: AnyDb;
  readonly userId: UserId;
} {
  return input.db != null && input.userId != null;
}

async function saveNewTransfer(
  input: SubmitTransferFormInput & { readonly db: AnyDb; readonly userId: UserId }
) {
  return createTransferMutationService({
    getDb: () => input.db,
    getUserId: () => input.userId,
    refresh: () => refreshTransactions(input.db, input.userId),
    saveTransferRow: saveTransfer,
  }).save({
    digits: input.digits,
    fromSide: input.fromSide,
    toSide: input.toSide,
    description: "",
    date: input.date,
  });
}

async function saveReclassifiedTransfer(
  input: SubmitTransferFormInput & {
    readonly db: AnyDb;
    readonly sourceTransaction: StoredTransaction;
    readonly userId: UserId;
  }
) {
  const result = reclassifyTransactionAsTransfer(input.db, {
    userId: input.userId,
    transactionId: input.sourceTransaction.id,
    processedEmailId: input.processedEmailId ?? undefined,
    digits: input.digits,
    fromSide: input.fromSide,
    toSide: input.toSide,
    description: input.sourceTransaction.description,
    date: input.date,
  });

  if (result.success) {
    await refreshTransactions(input.db, input.userId);
  }

  return result;
}

function didTransferSaveSucceed(
  result: TransferMutationResult | ReclassifyTransactionAsTransferResult
) {
  return result.success;
}

function resolveTransferDestination(processedEmailId: ProcessedEmailId | null) {
  return processedEmailId ? "needs-review" : "tabs";
}

export async function submitTransferForm(
  input: SubmitTransferFormInput
): Promise<SubmitTransferFormResult> {
  if (!hasTransferFormContext(input)) {
    return { success: false, error: "saveFailed" };
  }

  const result =
    input.sourceTransaction == null
      ? await saveNewTransfer(input)
      : await saveReclassifiedTransfer({
          ...input,
          sourceTransaction: input.sourceTransaction,
        });

  if (!didTransferSaveSucceed(result)) {
    return result;
  }

  return {
    success: true,
    destination: resolveTransferDestination(input.processedEmailId),
  };
}
