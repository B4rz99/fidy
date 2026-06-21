import type { AnyDb } from "@/shared/db";
import {
  captureWarning,
  generateTransactionId,
  trackTransactionDeleted,
  trackTransactionEdited,
} from "@/shared/lib";
import {
  amendManualTransactionWithLocalLedger,
  recordManualTransactionWithLocalLedger,
  voidTransactionWithLocalLedger,
} from "@/infrastructure/local-ledger/public";
import type { CategoryId, FinancialAccountId, TransactionId, UserId } from "@/shared/types/branded";
import {
  createTransactionMutationService,
  type TransactionMutationResult,
} from "./lib/mutation-service";
import { toStoredTransaction } from "./lib/build-transaction";
import type { StoredTransaction, TransactionType } from "./schema";
import { createTransactionQueryService } from "./services/create-transaction-query-service";
import { toTransactionFormInput } from "./store/form-input";
import { useTransactionStore } from "./store/state";

const PAGE_SIZE = 30;

let transactionsSessionId = 0;
let loadTransactionsRequestId = 0;
type UpdateTransactionDirectInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly id: TransactionId;
  readonly fields: {
    readonly type: TransactionType;
    readonly digits: string;
    readonly categoryId: CategoryId | null;
    readonly accountId: FinancialAccountId | null;
    readonly description: string;
    readonly date: Date;
  };
};

function isActiveTransactionSession(userId: UserId, sessionId: number): boolean {
  return (
    transactionsSessionId === sessionId && useTransactionStore.getState().activeUserId === userId
  );
}

function isCurrentTransactionsRequest(
  requestId: number,
  userId: UserId,
  sessionId: number
): boolean {
  return loadTransactionsRequestId === requestId && isActiveTransactionSession(userId, sessionId);
}

const getErrorType = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error;

function createLiveTransactionMutationService(db: AnyDb, userId: UserId, sessionId: number) {
  return createTransactionMutationService({
    getUserId: () => userId,
    recordManualTransaction: async (input) => {
      const result = await recordManualTransactionWithLocalLedger({
        db,
        userId: input.userId,
        transactionId: input.transactionId,
        input: input.input,
        now: input.now,
      });
      return result.success
        ? { success: true, transaction: toStoredTransaction(result.transaction) }
        : result;
    },
    amendManualTransaction: async (input) => {
      const result = await amendManualTransactionWithLocalLedger({
        db,
        userId: input.userId,
        transactionId: input.transactionId,
        input: input.input,
        now: input.now,
      });
      return result.success
        ? { success: true, transaction: toStoredTransaction(result.transaction) }
        : result;
    },
    voidTransaction: async (input) =>
      voidTransactionWithLocalLedger({
        db,
        userId: input.userId,
        transactionId: input.transactionId,
        now: input.now,
      }),
    refresh: async () => {
      if (!isActiveTransactionSession(userId, sessionId)) return;
      await refreshTransactions(db, userId);
    },
    cacheCommittedTransaction: (transaction) => {
      if (!isActiveTransactionSession(userId, sessionId)) return;
      useTransactionStore.getState().addToCache(transaction);
    },
    resetForm: () => {
      if (!isActiveTransactionSession(userId, sessionId)) return;
      useTransactionStore.getState().resetForm();
    },
    trackDeleted: trackTransactionDeleted,
    trackEdited: trackTransactionEdited,
    createId: generateTransactionId,
  });
}
export { useTransactionStore };

export function initializeTransactionSession(userId: UserId): void {
  transactionsSessionId += 1;
  loadTransactionsRequestId += 1;
  useTransactionStore.getState().beginSession(userId);
}

export async function loadInitialTransactions(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadTransactionsRequestId;
  const sessionId = transactionsSessionId;

  try {
    const snapshot = createTransactionQueryService().loadInitialSnapshot({
      db,
      userId,
      pageSize: PAGE_SIZE,
    });
    if (!isCurrentTransactionsRequest(requestId, userId, sessionId)) return;
    useTransactionStore.getState().setPageSnapshot(snapshot);
    useTransactionStore.getState().setAggregateSnapshot(snapshot);
  } catch {
    // DB read failed — keep existing state
  }
}

export async function loadNextTransactions(db: AnyDb, userId: UserId): Promise<void> {
  const sessionId = transactionsSessionId;
  if (!isActiveTransactionSession(userId, sessionId)) return;

  const { hasMore, offset } = useTransactionStore.getState();
  if (!hasMore) return;

  try {
    const snapshot = createTransactionQueryService().loadNextPage({
      db,
      userId,
      pageSize: PAGE_SIZE,
      offset,
    });
    if (!isActiveTransactionSession(userId, sessionId)) return;
    useTransactionStore.getState().appendPageSnapshot(snapshot);
  } catch {
    // DB read failed — keep existing state
  }
}

export function loadTransactionAggregates(db: AnyDb, userId: UserId): void {
  const sessionId = transactionsSessionId;
  if (!isActiveTransactionSession(userId, sessionId)) return;

  try {
    const snapshot = createTransactionQueryService().loadAggregateSnapshot({
      db,
      userId,
    });
    if (!isActiveTransactionSession(userId, sessionId)) return;
    useTransactionStore.getState().setAggregateSnapshot(snapshot);
  } catch {
    // Aggregate query failed — keep existing state
  }
}

export async function refreshTransactions(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadTransactionsRequestId;
  const sessionId = transactionsSessionId;

  try {
    const { pages, offset } = useTransactionStore.getState();
    const snapshot = createTransactionQueryService().loadRefreshSnapshot({
      db,
      userId,
      currentPages: pages,
      currentOffset: offset,
      pageSize: PAGE_SIZE,
    });
    if (!isCurrentTransactionsRequest(requestId, userId, sessionId)) return;
    useTransactionStore.getState().applyRefreshSnapshot(snapshot);
  } catch (error) {
    captureWarning("transactions_refresh_failed", {
      errorType: getErrorType(error),
    });
  }
}

export async function saveCurrentTransaction(
  db: AnyDb,
  userId: UserId
): Promise<TransactionMutationResult> {
  const sessionId = transactionsSessionId;
  if (!isActiveTransactionSession(userId, sessionId)) {
    return { success: false, error: "Store not initialized" };
  }

  return createLiveTransactionMutationService(db, userId, sessionId).save(
    toTransactionFormInput(useTransactionStore.getState())
  );
}

export async function removeTransaction(
  db: AnyDb,
  userId: UserId,
  id: TransactionId
): Promise<void> {
  const sessionId = transactionsSessionId;
  if (!isActiveTransactionSession(userId, sessionId)) return;
  await createLiveTransactionMutationService(db, userId, sessionId).remove(id);
}

export function loadTransactionIntoForm(db: AnyDb, userId: UserId, id: TransactionId): boolean {
  const sessionId = transactionsSessionId;
  if (!isActiveTransactionSession(userId, sessionId)) return false;

  try {
    const transaction = createTransactionQueryService().getStoredTransaction({
      db,
      userId,
      transactionId: id,
    });

    if (!isActiveTransactionSession(userId, sessionId)) return false;

    if (!transaction) {
      useTransactionStore.getState().resetForm();
      return false;
    }

    useTransactionStore.getState().hydrateEditingTransaction(id, transaction);
    return true;
  } catch {
    useTransactionStore.getState().resetForm();
    return false;
  }
}

export async function updateTransactionDirect(
  input: UpdateTransactionDirectInput
): Promise<TransactionMutationResult> {
  const { db, userId, id, fields } = input;
  const sessionId = transactionsSessionId;
  if (!isActiveTransactionSession(userId, sessionId)) {
    return { success: false, error: "Store not initialized" };
  }

  return createLiveTransactionMutationService(db, userId, sessionId).updateDirect(id, fields);
}

export async function deleteTransaction(
  db: AnyDb,
  userId: UserId,
  id: TransactionId
): Promise<void> {
  await removeTransaction(db, userId, id);
}

export function getStoredTransactionById(
  db: AnyDb,
  userId: UserId,
  id: TransactionId
): StoredTransaction | null {
  try {
    return createTransactionQueryService().getStoredTransaction({
      db,
      userId,
      transactionId: id,
    });
  } catch {
    return null;
  }
}
