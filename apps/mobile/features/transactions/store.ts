import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { transactions } from "@/shared/db/schema";
import { tryGetDb } from "@/shared/db/client";
import {
  type CloudLedgerCreateTransactionCommand,
  enqueueCloudLedgerOptimisticCreate,
  getCloudLedgerOutbox,
  getCloudLedgerRuntimeCache,
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
  loadRuntimeCloudLedgerTransactions,
} from "./services/cloud-ledger-optimistic-snapshot";
import { createTransactionQueryService } from "./services/create-transaction-query-service";
import { toTransactionFormInput } from "./store/form-input";
import { useTransactionStore } from "./store/state";

const PAGE_SIZE = 30;
const CLOUD_LEDGER_MAX_COP_AMOUNT = 2_147_483_647;
const CLOUD_LEDGER_TRANSACTION_SOURCE = "cloud_ledger";

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
  readonly db: AnyDb;
  readonly sessionId: number;
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
type TransactionInsertRow = typeof transactions.$inferInsert;

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
    recordManualTransaction: (input) =>
      recordManualTransactionWithCloudLedger({ ...input, db, sessionId }),
    amendManualTransaction: async (input) => {
      if (await isCloudLedgerTransactionReadOnly(db, input.userId, input.transactionId)) {
        return { success: false, error: "cloudLedgerMutationUnsupported" };
      }
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
    voidTransaction: async (input) => {
      if (await isCloudLedgerTransactionReadOnly(db, input.userId, input.transactionId)) {
        return { success: false, error: "cloudLedgerMutationUnsupported" };
      }
      return voidTransactionWithLocalLedger({
        db,
        userId: input.userId,
        transactionId: input.transactionId,
        now: input.now,
      });
    },
    refresh: async () => {
      if (!isActiveTransactionSession(userId, sessionId)) return;
      await refreshTransactions(db, userId);
    },
    cacheCommittedTransaction: (transaction, options) => {
      if (!isActiveTransactionSession(userId, sessionId)) return;
      useTransactionStore
        .getState()
        .addToCache(transaction, { countInPagination: options?.countInPagination ?? true });
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
  db,
  sessionId,
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
  const didPersistShadow =
    optimisticCreate.didWriteRuntimeCache &&
    isActiveTransactionSession(userId, sessionId) &&
    persistCloudLedgerTransactionShadow(db, transaction);
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
    countCachedTransactionInPagination: didPersistShadow,
    transaction,
  };
}

function persistCloudLedgerTransactionShadow(db: AnyDb, transaction: StoredTransaction): boolean {
  const row = toCloudLedgerTransactionShadowRow(transaction);
  try {
    if (isPersistedActiveTransaction(db, transaction.userId, transaction.id)) {
      db.update(transactions)
        .set(row)
        .where(
          and(eq(transactions.id, transaction.id), eq(transactions.userId, transaction.userId))
        )
        .run();
    } else {
      db.insert(transactions).values(row).run();
    }
    return true;
  } catch (error) {
    captureWarning("cloud_ledger_shadow_transaction_write_failed", {
      errorType: getErrorType(error),
    });
    return false;
  }
}

function toCloudLedgerTransactionShadowRow(transaction: StoredTransaction): TransactionInsertRow {
  return {
    accountAttributionState: transaction.accountAttributionState,
    accountId: transaction.accountId,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    counterpartyName: transaction.counterpartyName,
    createdAt: toIsoDateTime(transaction.createdAt),
    date: toIsoDate(transaction.date),
    description: transaction.description,
    id: transaction.id,
    source: CLOUD_LEDGER_TRANSACTION_SOURCE,
    supersededAt: transaction.supersededAt == null ? null : toIsoDateTime(transaction.supersededAt),
    supersededByTransferId: transaction.supersededByTransferId,
    type: transaction.type,
    updatedAt: toIsoDateTime(transaction.updatedAt),
    userId: transaction.userId,
    voidedAt: transaction.voidedAt == null ? null : toIsoDateTime(transaction.voidedAt),
  };
}

export function persistCloudLedgerRuntimeTransactionShadows(db: AnyDb, userId: UserId): void {
  const runtimeTransactions = loadRuntimeCloudLedgerTransactions(userId);
  runtimeTransactions.forEach((transaction) => {
    persistCloudLedgerTransactionShadow(db, transaction);
  });
  try {
    deleteCloudLedgerTransactionShadowsExcept(
      db,
      userId,
      runtimeTransactions.map((transaction) => transaction.id)
    );
  } catch (error) {
    captureWarning("cloud_ledger_shadow_transaction_prune_failed", {
      errorType: getErrorType(error),
    });
  }
}

export async function deletePendingCloudLedgerTransactionShadows(userId: UserId): Promise<void> {
  const db = tryGetDb(userId);
  if (db === null) return;

  let pendingTransactionIds: readonly TransactionId[];
  try {
    pendingTransactionIds = (await getCloudLedgerOutbox(userId).load()).flatMap((change) =>
      change.kind === "createTransaction" ? [change.transaction.id] : []
    );
  } catch (error) {
    captureWarning("cloud_ledger_shadow_transaction_delete_failed", {
      errorType: getErrorType(error),
    });
    deleteAllCloudLedgerTransactionShadows(db, userId);
    return;
  }
  deleteCloudLedgerTransactionShadows(db, userId, pendingTransactionIds);
}

const cloudLedgerShadowRowsForUser = (userId: UserId) =>
  and(eq(transactions.userId, userId), eq(transactions.source, CLOUD_LEDGER_TRANSACTION_SOURCE));

const deleteCloudLedgerTransactionShadows = (
  db: AnyDb,
  userId: UserId,
  transactionIds: readonly TransactionId[]
): void => {
  const uniqueTransactionIds = [...new Set(transactionIds)];
  if (uniqueTransactionIds.length === 0) return;

  db.delete(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, uniqueTransactionIds)))
    .run();
};

const deleteAllCloudLedgerTransactionShadows = (db: AnyDb, userId: UserId): void => {
  db.delete(transactions).where(cloudLedgerShadowRowsForUser(userId)).run();
};

const deleteCloudLedgerTransactionShadowsExcept = (
  db: AnyDb,
  userId: UserId,
  transactionIds: readonly TransactionId[]
): void => {
  const uniqueTransactionIds = [...new Set(transactionIds)];
  const staleShadowCondition =
    uniqueTransactionIds.length === 0
      ? cloudLedgerShadowRowsForUser(userId)
      : and(
          cloudLedgerShadowRowsForUser(userId),
          notInArray(transactions.id, uniqueTransactionIds)
        );
  db.delete(transactions).where(staleShadowCondition).run();
};

async function isCloudLedgerTransactionReadOnly(
  db: AnyDb,
  userId: UserId,
  transactionId: TransactionId
): Promise<boolean> {
  if (
    getCloudLedgerRuntimeCache(userId).transactions.some(
      (transaction) => transaction.id === transactionId
    )
  ) {
    return true;
  }
  if (isPersistedCloudLedgerTransactionShadow(db, userId, transactionId)) {
    return true;
  }
  return (await getCloudLedgerOutbox(userId).load()).some(
    (change) => change.kind === "createTransaction" && change.transaction.id === transactionId
  );
}

const isPersistedCloudLedgerTransactionShadow = (
  db: AnyDb,
  userId: UserId,
  transactionId: TransactionId
): boolean => {
  try {
    return (
      createTransactionQueryService().getStoredTransaction({
        db,
        userId,
        transactionId,
      })?.source === CLOUD_LEDGER_TRANSACTION_SOURCE
    );
  } catch {
    return false;
  }
};

function isPersistedActiveTransaction(db: AnyDb, userId: UserId, transactionId: TransactionId) {
  try {
    return (
      createTransactionQueryService().getStoredTransaction({
        db,
        userId,
        transactionId,
      }) !== null
    );
  } catch {
    return false;
  }
}

function validateCloudLedgerManualTransaction(
  input: RecordCloudLedgerManualTransactionInput["input"],
  now: Date
): CloudLedgerManualTransactionValidation {
  const amount = parseDigitsToAmount(input.digits);
  if (amount <= 0) return { success: false, error: "amountNotPositive" };
  if (amount > CLOUD_LEDGER_MAX_COP_AMOUNT) {
    return { success: false, error: "amountTooLarge" };
  }
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

export function resumeTransactionSession(userId: UserId): void {
  transactionsSessionId += 1;
  loadTransactionsRequestId += 1;
  useTransactionStore.setState({ activeUserId: userId });
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
  const optimisticSnapshot = await applyCloudLedgerOptimisticView(snapshot, userId, {
    isTransactionIncludedInAggregate: (transaction) =>
      isPersistedActiveTransaction(db, userId, transaction.id),
  });
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
    useTransactionStore.getState().setAggregateSnapshot(
      applyRuntimeCloudLedgerTransactions({ ...snapshot, pages, offset, hasMore }, userId, {
        isTransactionIncludedInAggregate: (transaction) =>
          isPersistedActiveTransaction(db, userId, transaction.id),
      })
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
    const optimisticSnapshot = await applyCloudLedgerOptimisticView(snapshot, userId, {
      isTransactionIncludedInAggregate: (transaction) =>
        isPersistedActiveTransaction(db, userId, transaction.id),
    });
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
