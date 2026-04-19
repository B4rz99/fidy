import { generateTransactionId, toIsoDateTime } from "@/shared/lib";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import type { CategoryId, TransactionId, UserId } from "@/shared/types/branded";
import type { StoredTransaction, TransactionType } from "../schema";
import { buildTransaction, toTransactionRow } from "./build-transaction";

export type TransactionFormInput = {
  type: TransactionType;
  digits: string;
  categoryId: CategoryId | null;
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
  refresh: () => Promise<void>;
  resetForm: () => void;
  trackDeleted: () => void;
  trackEdited: (input: { category: string }) => void;
  now?: () => Date;
  createId?: () => TransactionId;
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

async function commitTransaction(
  commit: WriteThroughMutationModule["commit"] | null,
  mode: "insert" | "update",
  transaction: StoredTransaction,
  message: string
) {
  if (!commit) {
    return fail("Store not initialized");
  }

  try {
    const result = await commit({
      kind: "transaction.save",
      mode,
      row: toTransactionRow(transaction),
    });

    return result.success ? result : fail(message);
  } catch {
    return fail(message);
  }
}

function buildMutationTransaction(
  input: TransactionFormInput,
  userId: UserId | null,
  id: TransactionId,
  now: Date,
  existing: StoredTransaction | null
) {
  if (!userId) {
    return fail("Store not initialized");
  }

  const result = buildTransaction(input, userId, id, now, existing);
  return result.success ? result : fail(result.error);
}

export function createTransactionMutationService(
  deps: CreateTransactionMutationServiceDeps
): TransactionMutationService {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? generateTransactionId;

  return {
    save: async (input) => {
      const built = buildMutationTransaction(input, deps.getUserId(), createId(), now(), null);
      if (!built.success) {
        return built;
      }

      const committed = await commitTransaction(
        deps.getCommit(),
        "insert",
        built.transaction,
        "Failed to save transaction"
      );
      if (!committed.success) {
        return committed;
      }

      await deps.refresh();
      return { success: true, transaction: built.transaction };
    },

    update: async (id, input) => {
      const built = buildMutationTransaction(
        input,
        deps.getUserId(),
        id,
        now(),
        deps.getTransactionById(id)
      );
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
      const built = buildMutationTransaction(
        input,
        deps.getUserId(),
        id,
        now(),
        deps.getTransactionById(id)
      );
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
          throw new Error(result.error);
        }

        deps.trackDeleted();
      }

      await deps.refresh();
    },
  };
}
