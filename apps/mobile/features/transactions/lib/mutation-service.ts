import { captureWarning, generateTransactionId, toIsoDateTime } from "@/shared/lib";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import type { CategoryId, FinancialAccountId, TransactionId, UserId } from "@/shared/types/branded";
import type { StoredTransaction, TransactionType } from "../schema";
import { buildTransaction, toTransactionRow } from "./build-transaction";

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
  getCommit: () => WriteThroughMutationModule["commit"] | null;
  getUserId: () => UserId | null;
  getTransactionById: (id: TransactionId) => StoredTransaction | null;
  recordManualTransaction: (input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly input: TransactionFormInput;
    readonly now: Date;
  }) => Promise<TransactionMutationResult>;
  refresh: () => Promise<void>;
  resetForm: () => void;
  trackDeleted: () => void;
  trackEdited: (input: { category: string }) => void;
  now?: () => Date;
  createId?: () => TransactionId;
};

type BuildMutationTransactionInput = {
  readonly form: TransactionFormInput;
  readonly userId: UserId | null;
  readonly transactionId: TransactionId;
  readonly now: Date;
  readonly existing: StoredTransaction | null;
};

export type TransactionMutationService = {
  save: (input: TransactionFormInput) => Promise<TransactionMutationResult>;
  update: (id: TransactionId, input: TransactionFormInput) => Promise<TransactionMutationResult>;
  updateDirect: (
    id: TransactionId,
    input: TransactionFormInput
  ) => Promise<TransactionMutationResult>;
  remove: (id: TransactionId) => Promise<void>;
};

const fail = (error: string): TransactionMutationResult => ({ success: false, error });

const errorType = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

async function commitTransaction(
  commit: WriteThroughMutationModule["commit"] | null,
  mode: "insert" | "update",
  transaction: StoredTransaction,
  message: string
) {
  if (!commit) {
    captureWarning("transaction_commit_unavailable", { mode });
    return fail("Store not initialized");
  }

  try {
    const result = await commit({
      kind: "transaction.save",
      mode,
      row: toTransactionRow(transaction),
    });

    if (!result.success) {
      captureWarning("transaction_commit_failed", {
        mode,
        errorType: "mutation_rejected",
      });
      return fail(message);
    }

    return result;
  } catch (error) {
    captureWarning("transaction_commit_exception", {
      mode,
      errorType: errorType(error),
    });
    return fail(message);
  }
}

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

function buildMutationTransaction(input: BuildMutationTransactionInput) {
  if (!input.userId) {
    return fail("Store not initialized");
  }

  const result = buildTransaction({
    input: input.form,
    userId: input.userId,
    id: input.transactionId,
    now: input.now,
    existing: input.existing,
  });
  return result.success ? result : fail(result.error);
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

      await deps.refresh();
      return result;
    },

    update: async (id, input) => {
      const built = buildMutationTransaction({
        form: input,
        userId: deps.getUserId(),
        transactionId: id,
        now: now(),
        existing: deps.getTransactionById(id),
      });
      if (!built.success) {
        return built;
      }

      const committed = await commitTransaction(
        deps.getCommit(),
        "update",
        built.transaction,
        "Failed to update transaction"
      );
      if (!committed.success) {
        return committed;
      }

      deps.trackEdited({ category: String(built.transaction.categoryId) });
      deps.resetForm();
      await deps.refresh();
      return { success: true, transaction: built.transaction };
    },

    updateDirect: async (id, input) => {
      const built = buildMutationTransaction({
        form: input,
        userId: deps.getUserId(),
        transactionId: id,
        now: now(),
        existing: deps.getTransactionById(id),
      });
      if (!built.success) {
        return built;
      }

      const committed = await commitTransaction(
        deps.getCommit(),
        "update",
        built.transaction,
        "Failed to update transaction"
      );
      if (!committed.success) {
        return committed;
      }

      deps.trackEdited({ category: String(built.transaction.categoryId) });
      await deps.refresh();
      return { success: true, transaction: built.transaction };
    },

    remove: async (id) => {
      const commit = deps.getCommit();
      if (commit) {
        const result = await commit({
          kind: "transaction.delete",
          transactionId: id,
          now: toIsoDateTime(now()),
        });

        if (!result.success) {
          captureWarning("transaction_delete_failed", {
            errorType: "mutation_rejected",
          });
          throw new Error(result.error);
        }

        deps.trackDeleted();
      }

      await deps.refresh();
    },
  };
}
