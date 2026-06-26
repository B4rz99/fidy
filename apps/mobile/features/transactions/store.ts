import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { financialAccounts, transactions, userCategories } from "@/shared/db/schema";
import { tryGetDb } from "@/shared/db/client";
import {
  type CloudLedgerCategory,
  type CloudLedgerCreateTransactionCommand,
  type CloudLedgerFinancialAccount,
} from "@/features/cloud-ledger/public";
import { getCloudLedgerOutbox } from "@/features/cloud-ledger/outbox.public";
import { getCloudLedgerRuntimeCache } from "@/features/cloud-ledger/runtime.public";
import { enqueueCloudLedgerOptimisticCreate } from "@/features/cloud-ledger/runtime-mutations.public";
import { readFinancialAccountKind } from "@/features/financial-accounts/display.public";
import { DEFAULT_CATEGORY_IDS, getBuiltInCategory } from "@/shared/categories";
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
  recordManualTransactionWithLocalLedger,
  voidTransactionWithLocalLedger,
} from "@/infrastructure/local-ledger/public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  TransactionId,
  UserCategoryId,
  UserId,
} from "@/shared/types/branded";
import {
  createTransactionMutationService,
  type TransactionMutationResult,
} from "./lib/mutation-service";
import { compareStoredTransactionsByRepositoryOrder } from "./lib/transaction-order";
import { toStoredTransaction } from "./lib/build-transaction";
import type { StoredTransaction, TransactionType } from "./schema";
import {
  cloudLedgerCreateCommandToStoredTransaction,
  cloudLedgerTransactionToStoredTransactions,
} from "./services/cloud-ledger-transaction-adapter";
import {
  applyCloudLedgerOptimisticView,
  applyRuntimeCloudLedgerTransactions,
} from "./services/cloud-ledger-optimistic-snapshot";
import { createTransactionQueryService } from "./services/create-transaction-query-service";
import { toTransactionFormInput } from "./store/form-input";
import { useTransactionStore } from "./store/state";

const PAGE_SIZE = 30;
const CLOUD_LEDGER_MAX_COP_AMOUNT = 2_147_483_647;
const CLOUD_LEDGER_TRANSACTION_SOURCE = "cloud_ledger";
const CLOUD_LEDGER_REFERENCE_FALLBACK_ACCOUNT_KIND = "cash";
const CLOUD_LEDGER_REFERENCE_FALLBACK_CATEGORY = getBuiltInCategory("other");

let transactionsSessionId = 0;
let loadTransactionsRequestId = 0;
let transactionSessionRemoteEffectsEnabled = true;
type InitializeTransactionSessionOptions = {
  readonly enableRemoteEffects?: boolean;
};
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
type FinancialAccountInsertRow = typeof financialAccounts.$inferInsert;
type UserCategoryInsertRow = typeof userCategories.$inferInsert;

const isActiveTransactionSession = (userId: UserId, sessionId: number): boolean =>
  transactionsSessionId === sessionId && useTransactionStore.getState().activeUserId === userId;

const isCurrentTransactionsRequest = (
  requestId: number,
  userId: UserId,
  sessionId: number
): boolean =>
  loadTransactionsRequestId === requestId && isActiveTransactionSession(userId, sessionId);

const canUseCloudLedgerTransactionEffects = (userId: UserId, sessionId: number): boolean =>
  isActiveTransactionSession(userId, sessionId) && transactionSessionRemoteEffectsEnabled;

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

async function recordManualTransactionWithCloudLedger(
  input: RecordCloudLedgerManualTransactionInput
): Promise<TransactionMutationResult> {
  const recorder = canUseCloudLedgerTransactionEffects(input.userId, input.sessionId)
    ? recordManualTransactionWithCloudLedgerEffects
    : recordManualTransactionWithLocalLedgerCache;
  return recorder(input);
}

async function recordManualTransactionWithLocalLedgerCache({
  db,
  userId,
  transactionId,
  input,
  now,
}: RecordCloudLedgerManualTransactionInput): Promise<TransactionMutationResult> {
  const result = await recordManualTransactionWithLocalLedger({
    db,
    userId,
    transactionId,
    input,
    now,
  });
  return result.success
    ? { success: true, transaction: toStoredTransaction(result.transaction) }
    : result;
}

async function recordManualTransactionWithCloudLedgerEffects({
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
  const shouldCountCachedTransactionInPagination =
    didPersistShadow && isWithinLoadedTransactionPageWindow(transaction);
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
    countCachedTransactionInPagination: shouldCountCachedTransactionInPagination,
    transaction,
  };
}

function isWithinLoadedTransactionPageWindow(transaction: StoredTransaction): boolean {
  const { pages, offset } = useTransactionStore.getState();
  if (offset <= 0) {
    return false;
  }
  const precedingVisibleTransactions = pages.filter(
    (page) =>
      page.id !== transaction.id &&
      compareStoredTransactionsByRepositoryOrder(page, transaction) <= 0
  ).length;
  return precedingVisibleTransactions < offset;
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
  const runtimeCache = getCloudLedgerRuntimeCache(userId);
  persistCloudLedgerRuntimeReferences(db, userId, runtimeCache);
  const runtimeTransactions = runtimeCache.transactions.flatMap((transaction) =>
    cloudLedgerTransactionToStoredTransactions(userId, transaction)
  );
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

function persistCloudLedgerRuntimeReferences(
  db: AnyDb,
  userId: UserId,
  runtimeCache: ReturnType<typeof getCloudLedgerRuntimeCache>
): void {
  runtimeCache.financialAccounts.forEach((account) => {
    persistCloudLedgerFinancialAccountReference(db, userId, account);
  });
  runtimeCache.categories
    .filter((category) => !DEFAULT_CATEGORY_IDS.has(category.id))
    .forEach((category) => {
      persistCloudLedgerUserCategoryReference(db, userId, category);
    });
}

function persistCloudLedgerFinancialAccountReference(
  db: AnyDb,
  userId: UserId,
  account: CloudLedgerFinancialAccount
): void {
  const row = toCloudLedgerFinancialAccountRow(userId, account);
  try {
    db.insert(financialAccounts).values(row).onConflictDoNothing().run();
  } catch (error) {
    captureWarning("cloud_ledger_shadow_account_reference_write_failed", {
      errorType: getErrorType(error),
    });
  }
}

function persistCloudLedgerUserCategoryReference(
  db: AnyDb,
  userId: UserId,
  category: CloudLedgerCategory
): void {
  const row = toCloudLedgerUserCategoryRow(userId, category);
  try {
    db.insert(userCategories).values(row).onConflictDoNothing().run();
  } catch (error) {
    captureWarning("cloud_ledger_shadow_category_reference_write_failed", {
      errorType: getErrorType(error),
    });
  }
}

function toCloudLedgerFinancialAccountRow(
  userId: UserId,
  account: CloudLedgerFinancialAccount
): FinancialAccountInsertRow {
  return {
    createdAt: account.updatedAt,
    deletedAt: null,
    id: account.id,
    isDefault: false,
    kind: toCloudLedgerFinancialAccountKind(account),
    name: account.name,
    paymentDueDay: null,
    statementClosingDay: null,
    updatedAt: account.updatedAt,
    userId,
  };
}

function toCloudLedgerFinancialAccountKind(account: CloudLedgerFinancialAccount): string {
  try {
    return readFinancialAccountKind(account.type);
  } catch {
    captureWarning("cloud_ledger_shadow_account_reference_kind_normalized", {
      accountType: account.type,
    });
    return CLOUD_LEDGER_REFERENCE_FALLBACK_ACCOUNT_KIND;
  }
}

function toCloudLedgerUserCategoryRow(
  userId: UserId,
  category: CloudLedgerCategory
): UserCategoryInsertRow {
  return {
    colorHex: category.color ?? CLOUD_LEDGER_REFERENCE_FALLBACK_CATEGORY.color,
    createdAt: category.updatedAt,
    deletedAt: null,
    iconName: category.icon ?? CLOUD_LEDGER_REFERENCE_FALLBACK_CATEGORY.icon,
    id: category.id as unknown as UserCategoryId,
    name: category.name,
    updatedAt: category.updatedAt,
    userId,
  };
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
  try {
    return (await getCloudLedgerOutbox(userId).load()).some(
      (change) => change.kind === "createTransaction" && change.transaction.id === transactionId
    );
  } catch (error) {
    captureWarning("cloud_ledger_read_only_outbox_lookup_failed", {
      errorType: getErrorType(error),
    });
    return false;
  }
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
  const description = input.description.trim();
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
  if (description.length > 200) return { success: false, error: "descriptionTooLong" };

  return {
    success: true,
    transaction: {
      accountId: input.accountId,
      amount,
      categoryId: input.categoryId,
      date: input.date,
      description,
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

export function initializeTransactionSession(
  userId: UserId,
  options: InitializeTransactionSessionOptions = {}
): void {
  transactionsSessionId += 1;
  loadTransactionsRequestId += 1;
  transactionSessionRemoteEffectsEnabled = options.enableRemoteEffects ?? true;
  useTransactionStore.getState().beginSession(userId);
}

export function invalidateTransactionSession(): void {
  transactionsSessionId += 1;
  loadTransactionsRequestId += 1;
  transactionSessionRemoteEffectsEnabled = false;
  useTransactionStore.setState({ activeUserId: null });
}

export function resumeTransactionSession(userId: UserId): void {
  transactionsSessionId += 1;
  loadTransactionsRequestId += 1;
  transactionSessionRemoteEffectsEnabled = true;
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
  const optimisticSnapshot = await applyInitialCloudLedgerOptimisticView({
    db,
    sessionId,
    snapshot,
    userId,
  });
  if (!isCurrentTransactionsRequest(requestId, userId, sessionId)) return;
  useTransactionStore.getState().setPageSnapshot(optimisticSnapshot);
  useTransactionStore.getState().setAggregateSnapshot(optimisticSnapshot);
}

async function applyInitialCloudLedgerOptimisticView({
  db,
  sessionId,
  snapshot,
  userId,
}: {
  readonly db: AnyDb;
  readonly sessionId: number;
  readonly snapshot: ReturnType<
    ReturnType<typeof createTransactionQueryService>["loadInitialSnapshot"]
  >;
  readonly userId: UserId;
}) {
  if (!canUseCloudLedgerTransactionEffects(userId, sessionId)) return snapshot;

  try {
    return await applyCloudLedgerOptimisticView(snapshot, userId, {
      isTransactionIncludedInAggregate: (transaction) =>
        isPersistedActiveTransaction(db, userId, transaction.id),
      pageWindowSize: Math.max(snapshot.offset, PAGE_SIZE),
    });
  } catch (error) {
    captureWarning("transactions_initial_cloud_ledger_overlay_failed", {
      errorType: getErrorType(error),
    });
    return snapshot;
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
    const { pages, offset, hasMore } = useTransactionStore.getState();
    const aggregateSnapshot = { ...snapshot, pages, offset, hasMore };
    useTransactionStore.getState().setAggregateSnapshot(
      canUseCloudLedgerTransactionEffects(userId, sessionId)
        ? applyRuntimeCloudLedgerTransactions(aggregateSnapshot, userId, {
            isTransactionIncludedInAggregate: (transaction) =>
              isPersistedActiveTransaction(db, userId, transaction.id),
            pageWindowSize: Math.max(aggregateSnapshot.offset, PAGE_SIZE),
          })
        : aggregateSnapshot
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
    const optimisticSnapshot = await applyRefreshCloudLedgerOptimisticView({
      db,
      sessionId,
      snapshot,
      userId,
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

async function applyRefreshCloudLedgerOptimisticView({
  db,
  sessionId,
  snapshot,
  userId,
}: {
  readonly db: AnyDb;
  readonly sessionId: number;
  readonly snapshot: ReturnType<
    ReturnType<typeof createTransactionQueryService>["loadRefreshSnapshot"]
  >;
  readonly userId: UserId;
}) {
  if (!canUseCloudLedgerTransactionEffects(userId, sessionId)) return snapshot;

  try {
    return await applyCloudLedgerOptimisticView(snapshot, userId, {
      isTransactionIncludedInAggregate: (transaction) =>
        isPersistedActiveTransaction(db, userId, transaction.id),
      pageWindowSize: Math.max(snapshot.offset, PAGE_SIZE),
    });
  } catch (error) {
    captureWarning("transactions_refresh_cloud_ledger_overlay_failed", {
      errorType: getErrorType(error),
    });
    return applyRuntimeCloudLedgerTransactions(snapshot, userId, {
      isTransactionIncludedInAggregate: (transaction) =>
        isPersistedActiveTransaction(db, userId, transaction.id),
      pageWindowSize: Math.max(snapshot.offset, PAGE_SIZE),
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
