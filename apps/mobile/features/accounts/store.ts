import { eq } from "drizzle-orm";
import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import { transactions } from "@/shared/db/schema";
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
  toStoredAccount,
  updateAccount,
} from "./lib/repository";
import type { CreateAccountInput, StoredAccount } from "./schema";

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

    // Bootstrap: create default account if none exist (first run after migration)
    if (rows.length === 0) {
      const id = generateAccountId();
      const now = toIsoDateTime(new Date());
      insertAccount(dbRef, {
        id,
        userId: userIdRef,
        name: "Principal",
        type: "debit",
        bankKey: "other",
        identifiers: "[]",
        initialBalance: 0 as CopAmount,
        isDefault: true,
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
      // Backfill existing transactions with default account
      dbRef
        .update(transactions)
        .set({ accountId: id })
        .where(eq(transactions.accountId, "" as AccountId))
        .run();

      // Re-read to get the newly created account
      const refreshed = getAccountsByUser(dbRef, userIdRef);
      const accts = refreshed.map(toStoredAccount);
      set({ accounts: accts, defaultAccountId: id });
      return;
    }

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
      isDefault: false,
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
