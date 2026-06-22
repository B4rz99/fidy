import { captureWarning, generateTransactionId } from "@/shared/lib";
import type { CategoryId, FinancialAccountId, TransactionId, UserId } from "@/shared/types/branded";
import type { StoredTransaction, TransactionType } from "../schema";

export type TransactionFormInput = {
  type: TransactionType;
  digits: string;
  categoryId: CategoryId | null;
  accountId: FinancialAccountId | null;
  description: string;
  date: Date;
};

export type TransactionMutationResult =
  | { success: true; transaction: StoredTransaction }
  | { success: false; error: string };

type CreateTransactionMutationServiceDeps = {
  getUserId: () => UserId | null;
  recordManualTransaction: (input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly input: TransactionFormInput;
    readonly now: Date;
  }) => Promise<TransactionMutationResult>;
  amendManualTransaction: (input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly input: TransactionFormInput;
    readonly now: Date;
  }) => Promise<TransactionMutationResult>;
  voidTransaction: (input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly now: Date;
  }) => Promise<{ readonly success: true } | { readonly success: false; readonly error: string }>;
  refresh: () => Promise<void>;
  cacheCommittedTransaction?: (transaction: StoredTransaction) => void;
  refreshAfterSave?: boolean;
  resetForm: () => void;
  trackDeleted: () => void;
  trackEdited: (input: { category: string }) => void;
  now?: () => Date;
  createId?: () => TransactionId;
};

export type TransactionMutationService = {
  save: (input: TransactionFormInput) => Promise<TransactionMutationResult>;
  updateDirect: (
    id: TransactionId,
    input: TransactionFormInput
  ) => Promise<TransactionMutationResult>;
  remove: (id: TransactionId) => Promise<void>;
};

const fail = (error: string): TransactionMutationResult => ({ success: false, error });

const errorType = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

async function recordManualTransaction(
  deps: Pick<CreateTransactionMutationServiceDeps, "recordManualTransaction">,
  input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly form: TransactionFormInput;
    readonly now: Date;
  }
): Promise<TransactionMutationResult> {
  try {
    return await deps.recordManualTransaction({
      userId: input.userId,
      transactionId: input.transactionId,
      input: input.form,
      now: input.now,
    });
  } catch (error) {
    captureWarning("transaction_manual_record_exception", {
      errorType: errorType(error),
    });
    return fail("Failed to save transaction");
  }
}

async function amendManualTransaction(
  deps: Pick<CreateTransactionMutationServiceDeps, "amendManualTransaction">,
  input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly form: TransactionFormInput;
    readonly now: Date;
  }
): Promise<TransactionMutationResult> {
  try {
    return await deps.amendManualTransaction({
      userId: input.userId,
      transactionId: input.transactionId,
      input: input.form,
      now: input.now,
    });
  } catch (error) {
    captureWarning("transaction_manual_amend_exception", {
      errorType: errorType(error),
    });
    return fail("Failed to update transaction");
  }
}

export function createTransactionMutationService(
  deps: CreateTransactionMutationServiceDeps
): TransactionMutationService {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? generateTransactionId;

  return {
    save: async (input) => {
      const userId = deps.getUserId();
      if (!userId) {
        return fail("Store not initialized");
      }

      const result = await recordManualTransaction(deps, {
        userId,
        transactionId: createId(),
        form: input,
        now: now(),
      });
      if (!result.success) {
        return result;
      }

      deps.cacheCommittedTransaction?.(result.transaction);
      if (deps.refreshAfterSave ?? true) {
        await deps.refresh();
      }
      return result;
    },

    updateDirect: async (id, input) => {
      const userId = deps.getUserId();
      if (!userId) {
        return fail("Store not initialized");
      }

      const result = await amendManualTransaction(deps, {
        userId,
        transactionId: id,
        form: input,
        now: now(),
      });
      if (!result.success) {
        return result;
      }

      deps.trackEdited({ category: String(result.transaction.categoryId) });
      await deps.refresh();
      return result;
    },

    remove: async (id) => {
      const userId = deps.getUserId();
      if (!userId) {
        await deps.refresh();
        return;
      }

      const result = await deps.voidTransaction({
        userId,
        transactionId: id,
        now: now(),
      });
      if (!result.success) {
        captureWarning("transaction_delete_failed", {
          errorType: "mutation_rejected",
        });
        throw new Error(result.error);
      }

      deps.trackDeleted();
      await deps.refresh();
    },
  };
}
