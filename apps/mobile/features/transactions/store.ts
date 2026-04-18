import { create } from "zustand";
import { createWriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import {
  generateTransactionId,
  trackTransactionDeleted,
  trackTransactionEdited,
} from "@/shared/lib";
import type { CategoryId, TransactionId, UserId } from "@/shared/types/branded";
import {
  createTransactionMutationService,
  type TransactionMutationResult,
} from "./lib/mutation-service";
import type { StoredTransaction, TransactionType } from "./schema";
import {
  type CategorySpendingItem,
  createTransactionQueryService,
  type DailySpendingItem,
  type TransactionAggregateSnapshot,
  type TransactionPageSnapshot,
  type TransactionRefreshSnapshot,
} from "./services/create-transaction-query-service";

type FormStep = 1 | 2;

const PAGE_SIZE = 30;

let transactionsSessionId = 0;
let loadTransactionsRequestId = 0;

type TransactionState = {
  readonly activeUserId: UserId | null;
  readonly step: FormStep;
  readonly type: TransactionType;
  readonly digits: string;
  readonly categoryId: CategoryId | null;
  readonly description: string;
  readonly date: Date;
  readonly pages: readonly StoredTransaction[];
  readonly offset: number;
  readonly hasMore: boolean;
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly dailySpending: readonly DailySpendingItem[];
  readonly dataRevision: number;
  readonly editingId: TransactionId | null;
};

type TransactionActions = {
  beginSession: (userId: UserId) => void;
  setStep: (step: FormStep) => void;
  setType: (type: TransactionType) => void;
  setDigits: (digits: string) => void;
  setCategoryId: (id: CategoryId) => void;
  setDescription: (desc: string) => void;
  setDate: (date: Date) => void;
  setPageSnapshot: (snapshot: TransactionPageSnapshot) => void;
  appendPageSnapshot: (snapshot: TransactionPageSnapshot) => void;
  setAggregateSnapshot: (snapshot: TransactionAggregateSnapshot) => void;
  applyRefreshSnapshot: (snapshot: TransactionRefreshSnapshot) => void;
  hydrateEditingTransaction: (id: TransactionId, transaction: StoredTransaction) => void;
  addToCache: (tx: StoredTransaction) => void;
  removeFromCache: (id: TransactionId) => void;
  resetForm: () => void;
};

const INITIAL_FORM: Pick<
  TransactionState,
  "step" | "type" | "digits" | "categoryId" | "description"
> = {
  step: 1,
  type: "expense",
  digits: "",
  categoryId: null,
  description: "",
};

function createInitialState(activeUserId: UserId | null): TransactionState {
  return {
    activeUserId,
    ...INITIAL_FORM,
    date: new Date(),
    pages: [],
    offset: 0,
    hasMore: true,
    balance: 0,
    categorySpending: [],
    dailySpending: [],
    dataRevision: 0,
    editingId: null,
  };
}

function toTransactionFormInput(
  state: Pick<TransactionState, "type" | "digits" | "categoryId" | "description" | "date">
) {
  return {
    type: state.type,
    digits: state.digits,
    categoryId: state.categoryId,
    description: state.description,
    date: state.date,
  };
}

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

function createLiveTransactionMutationService(db: AnyDb, userId: UserId, sessionId: number) {
  const mutations = createWriteThroughMutationModule(db);

  return createTransactionMutationService({
    getCommit: () => mutations.commit,
    getUserId: () => userId,
    refresh: async () => {
      if (!isActiveTransactionSession(userId, sessionId)) return;
      await refreshTransactions(db, userId);
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

export const useTransactionStore = create<TransactionState & TransactionActions>((set) => ({
  ...createInitialState(null),

  beginSession: (userId) => set(createInitialState(userId)),
  setStep: (step) => set({ step }),
  setType: (type) => set({ type }),
  setDigits: (digits) => set({ digits }),
  setCategoryId: (categoryId) => set({ categoryId }),
  setDescription: (description) => set({ description }),
  setDate: (date) => set({ date }),

  setPageSnapshot: (snapshot) =>
    set({
      pages: [...snapshot.pages],
      offset: snapshot.offset,
      hasMore: snapshot.hasMore,
    }),

  appendPageSnapshot: (snapshot) =>
    set((state) => ({
      pages: [...state.pages, ...snapshot.pages],
      offset: state.offset + snapshot.pages.length,
      hasMore: snapshot.hasMore,
    })),

  setAggregateSnapshot: (snapshot) =>
    set({
      balance: snapshot.balance,
      categorySpending: [...snapshot.categorySpending],
      dailySpending: [...snapshot.dailySpending],
    }),

  applyRefreshSnapshot: (snapshot) =>
    set((state) => ({
      ...(snapshot.sameData ? null : { pages: [...snapshot.pages] }),
      offset: snapshot.offset,
      hasMore: snapshot.hasMore,
      balance: snapshot.balance,
      categorySpending: [...snapshot.categorySpending],
      dailySpending: [...snapshot.dailySpending],
      dataRevision: state.dataRevision + 1,
    })),

  hydrateEditingTransaction: (id, transaction) =>
    set({
      editingId: id,
      type: transaction.type,
      digits: String(transaction.amount),
      categoryId: transaction.categoryId,
      description: transaction.description,
      date: transaction.date,
    }),

  addToCache: (transaction) =>
    set((state) => ({
      pages: [transaction, ...state.pages],
      offset: state.offset + 1,
      dataRevision: state.dataRevision + 1,
    })),

  removeFromCache: (id) =>
    set((state) => {
      const pages = state.pages.filter((transaction) => transaction.id !== id);
      const removed = pages.length < state.pages.length;

      return {
        pages,
        offset: removed ? Math.max(0, state.offset - 1) : state.offset,
        dataRevision: removed ? state.dataRevision + 1 : state.dataRevision,
      };
    }),

  resetForm: () =>
    set({
      ...INITIAL_FORM,
      date: new Date(),
      editingId: null,
    }),
}));

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
  } catch {
    // Refresh failed — keep existing state
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

export async function updateCurrentTransaction(
  db: AnyDb,
  userId: UserId,
  id: TransactionId
): Promise<TransactionMutationResult> {
  const sessionId = transactionsSessionId;
  if (!isActiveTransactionSession(userId, sessionId)) {
    return { success: false, error: "Store not initialized" };
  }

  return createLiveTransactionMutationService(db, userId, sessionId).update(
    id,
    toTransactionFormInput(useTransactionStore.getState())
  );
}

export async function updateTransactionDirect(
  db: AnyDb,
  userId: UserId,
  id: TransactionId,
  fields: {
    readonly type: TransactionType;
    readonly digits: string;
    readonly categoryId: CategoryId | null;
    readonly description: string;
    readonly date: Date;
  }
): Promise<TransactionMutationResult> {
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
