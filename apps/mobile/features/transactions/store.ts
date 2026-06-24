import type { AnyDb } from "@/shared/db";
import {
  type CloudLedgerCreateTransactionCommand,
  enqueueCloudLedgerOptimisticCreate,
} from "@/features/cloud-ledger/public";
import {
  captureWarning,
  generateLedgerChangeId,
  generateTransactionId,
  parseDigitsToAmount,
  toIsoDate,
  toIsoDateTime,
  trackTransactionDeleted,
  trackTransactionEdited,
} from "@/shared/lib";
import {
  amendManualTransactionWithLocalLedger,
  voidTransactionWithLocalLedger,
} from "@/infrastructure/local-ledger/public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import {
  createTransactionMutationService,
  type TransactionMutationResult,
} from "./lib/mutation-service";
import { toStoredTransaction } from "./lib/build-transaction";
import type { StoredTransaction, TransactionType } from "./schema";
import { cloudLedgerCreateCommandToStoredTransaction } from "./services/cloud-ledger-transaction-adapter";
import {
  applyCloudLedgerOptimisticView,
  applyRuntimeCloudLedgerTransactions,
} from "./services/cloud-ledger-optimistic-snapshot";
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
type RecordCloudLedgerManualTransactionInput = {
  readonly userId: UserId;
  readonly transactionId: TransactionId;
  readonly input: {
    readonly type: TransactionType;
    readonly digits: string;
    readonly categoryId: CategoryId | null;
    readonly accountId: FinancialAccountId | null;
    readonly description: string;
    readonly date: Date;
  };
  readonly now: Date;
};
type ValidCloudLedgerManualTransaction = {
  readonly accountId: FinancialAccountId;
  readonly amount: CopAmount;
  readonly categoryId: CategoryId;
  readonly date: Date;
  readonly description: string;
  readonly isoDate: IsoDate;
  readonly type: TransactionType;
};
type CloudLedgerManualTransactionValidation =
  | { readonly success: true; readonly transaction: ValidCloudLedgerManualTransaction }
  | { readonly success: false; readonly error: string };

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
    recordManualTransaction: recordManualTransactionWithCloudLedger,
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
      useTransactionStore.getState().addToCache(transaction, { countInPagination: false });
    },
    refreshAfterSave: false,
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

async function recordManualTransactionWithCloudLedger({
  userId,
  transactionId,
  input,
  now,
}: RecordCloudLedgerManualTransactionInput): Promise<TransactionMutationResult> {
  const validation = validateCloudLedgerManualTransaction(input, now);
  if (!validation.success) return validation;

  const command = toCloudLedgerCreateTransactionCommand(transactionId, validation.transaction);
  const optimisticCreate = await enqueueCloudLedgerOptimisticCreate({
    userId,
    changeId: generateLedgerChangeId(),
    command,
    createdAt: toIsoDateTime(now),
  });
  const transaction = cloudLedgerCreateCommandToStoredTransaction({
    userId,
    command,
    createdAt: now,
  });
  if (transaction === null) {
    return { success: false, error: "missingCategory" };
  }
  if (optimisticCreate.didWriteRuntimeCache) {
    void optimisticCreate.flushIfOnline().catch((error) => {
      captureWarning("cloud_ledger_outbox_flush_failed", {
        errorType: getErrorType(error),
      });
    });
  }

  return {
    success: true,
    cacheCommittedTransaction: optimisticCreate.didWriteRuntimeCache,
    transaction,
  };
}

function validateCloudLedgerManualTransaction(
  input: RecordCloudLedgerManualTransactionInput["input"],
  now: Date
): CloudLedgerManualTransactionValidation {
  const amount = parseDigitsToAmount(input.digits);
  if (amount <= 0) return { success: false, error: "amountNotPositive" };
  if (input.accountId === null) return { success: false, error: "missingAccount" };
  if (input.categoryId === null) return { success: false, error: "missingCategory" };
  if (toIsoDate(input.date) > toIsoDate(now)) {
    return { success: false, error: "futureDatedTransaction" };
  }
  if (input.description.length > 200) return { success: false, error: "descriptionTooLong" };

  return {
    success: true,
    transaction: {
      accountId: input.accountId,
      amount,
      categoryId: input.categoryId,
      date: input.date,
      description: input.description.trim(),
      isoDate: toIsoDate(input.date),
      type: input.type,
    },
  };
}

function toCloudLedgerCreateTransactionCommand(
  transactionId: TransactionId,
  transaction: ValidCloudLedgerManualTransaction
): CloudLedgerCreateTransactionCommand {
  return {
    commandVersion: 1,
    transaction: {
      accountId: transaction.accountId,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      currency: "COP",
      date: transaction.isoDate,
      description: transaction.description || null,
      id: transactionId,
      type: transaction.type,
    },
  };
}

export function initializeTransactionSession(userId: UserId): void {
  transactionsSessionId += 1;
  loadTransactionsRequestId += 1;
  useTransactionStore.getState().beginSession(userId);
}

export function invalidateTransactionSession(): void {
  transactionsSessionId += 1;
  loadTransactionsRequestId += 1;
}

export async function loadInitialTransactions(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadTransactionsRequestId;
  const sessionId = transactionsSessionId;
  const queryService = createTransactionQueryService();

  let snapshot: ReturnType<typeof queryService.loadInitialSnapshot>;
  try {
    snapshot = queryService.loadInitialSnapshot({
      db,
      userId,
      pageSize: PAGE_SIZE,
    });
  } catch {
    // DB read failed — keep existing state
    return;
  }
  if (!isCurrentTransactionsRequest(requestId, userId, sessionId)) return;
  const optimisticSnapshot = await applyCloudLedgerOptimisticView(snapshot, userId);
  if (!isCurrentTransactionsRequest(requestId, userId, sessionId)) return;
  useTransactionStore.getState().setPageSnapshot(optimisticSnapshot);
  useTransactionStore.getState().setAggregateSnapshot(optimisticSnapshot);
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
    const { pages, offset, hasMore } = useTransactionStore.getState();
    useTransactionStore
      .getState()
      .setAggregateSnapshot(
        applyRuntimeCloudLedgerTransactions({ ...snapshot, pages, offset, hasMore }, userId)
      );
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
    const optimisticSnapshot = await applyCloudLedgerOptimisticView(snapshot, userId);
    if (!isCurrentTransactionsRequest(requestId, userId, sessionId)) return;
    useTransactionStore.getState().applyRefreshSnapshot({
      ...optimisticSnapshot,
      sameData: optimisticSnapshot === snapshot ? snapshot.sameData : false,
    });
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
