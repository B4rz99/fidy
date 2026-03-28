import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import { generateAccountId, generateSyncQueueId, toIsoDateTime } from "@/shared/lib";
import type { AccountId, CopAmount, TransactionId, UserId } from "@/shared/types/branded";
import {
  type AccountRow,
  getAccountsByUser,
  getReviewCount,
  insertAccount,
  reassignTransactionAccount,
  setDefaultAccount,
  softDeleteAccount,
  updateAccount,
} from "./lib/repository";
import type { BankKey, CreateAccountInput, StoredAccount } from "./schema";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;

type AccountState = {
  accounts: StoredAccount[];
  defaultAccountId: AccountId | null;
  reviewCount: number;
};

type AccountActions = {
  initStore: (db: AnyDb, userId: UserId) => void;
  loadAccounts: () => void;
  createAccount: (input: CreateAccountInput) => AccountId;
  updateAccountById: (
    id: AccountId,
    updates: Partial<
      Pick<AccountRow, "name" | "type" | "bankKey" | "identifiers" | "initialBalance">
    >
  ) => void;
  deleteAccount: (id: AccountId) => void;
  setDefault: (id: AccountId) => void;
  loadReviewCount: () => void;
  reassignTransaction: (txId: TransactionId, accountId: AccountId) => void;
};

type AccountDbRow = {
  id: AccountId;
  userId: UserId;
  name: string;
  type: string;
  bankKey: string;
  identifiers: string;
  initialBalance: CopAmount;
  isDefault: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

function toStoredAccount(row: AccountDbRow): StoredAccount {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type as StoredAccount["type"],
    bankKey: row.bankKey as BankKey,
    identifiers: JSON.parse(row.identifiers) as readonly string[],
    initialBalance: row.initialBalance,
    isDefault: row.isDefault === 1,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
  };
}

export const useAccountStore = create<AccountState & AccountActions>((set, get) => ({
  accounts: [],
  defaultAccountId: null,
  reviewCount: 0,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
  },

  loadAccounts: () => {
    if (!dbRef || !userIdRef) return;
    const rows = getAccountsByUser(dbRef, userIdRef);
    const accounts = rows.map(toStoredAccount);
    const defaultAcct = accounts.find((a) => a.isDefault);
    set({
      accounts,
      defaultAccountId: defaultAcct?.id ?? null,
    });
  },

  createAccount: (input) => {
    if (!dbRef || !userIdRef) throw new Error("Store not initialized");
    const id = generateAccountId();
    const now = toIsoDateTime(new Date());

    insertAccount(dbRef, {
      id,
      userId: userIdRef,
      name: input.name,
      type: input.type,
      bankKey: input.bankKey,
      identifiers: JSON.stringify(input.identifiers),
      initialBalance: input.initialBalance as CopAmount,
      isDefault: 0,
      createdAt: now,
      updatedAt: now,
    });

    enqueueSync(dbRef, {
      id: generateSyncQueueId(),
      tableName: "accounts",
      rowId: id,
      operation: "insert",
      createdAt: now,
    });

    get().loadAccounts();
    return id;
  },

  updateAccountById: (id, updates) => {
    if (!dbRef) return;
    const now = toIsoDateTime(new Date());
    updateAccount(dbRef, id, updates, now);

    enqueueSync(dbRef, {
      id: generateSyncQueueId(),
      tableName: "accounts",
      rowId: id,
      operation: "update",
      createdAt: now,
    });

    get().loadAccounts();
  },

  deleteAccount: (id) => {
    if (!dbRef) return;
    const now = toIsoDateTime(new Date());
    softDeleteAccount(dbRef, id, now);

    enqueueSync(dbRef, {
      id: generateSyncQueueId(),
      tableName: "accounts",
      rowId: id,
      operation: "update",
      createdAt: now,
    });

    get().loadAccounts();
  },

  setDefault: (id) => {
    if (!dbRef || !userIdRef) return;
    const now = toIsoDateTime(new Date());
    setDefaultAccount(dbRef, userIdRef, id, now);

    enqueueSync(dbRef, {
      id: generateSyncQueueId(),
      tableName: "accounts",
      rowId: id,
      operation: "update",
      createdAt: now,
    });

    get().loadAccounts();
  },

  loadReviewCount: () => {
    if (!dbRef || !userIdRef) return;
    const count = getReviewCount(dbRef, userIdRef);
    set({ reviewCount: count });
  },

  reassignTransaction: (txId, accountId) => {
    if (!dbRef) return;
    const now = toIsoDateTime(new Date());
    reassignTransactionAccount(dbRef, txId, accountId, now);

    enqueueSync(dbRef, {
      id: generateSyncQueueId(),
      tableName: "transactions",
      rowId: txId,
      operation: "update",
      createdAt: now,
    });

    get().loadReviewCount();
  },
}));
