import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import {
  createWriteThroughMutationModule,
  type WriteThroughMutationModule,
} from "@/shared/mutations";
import type { UserId } from "@/shared/types/branded";
import { buildCreateAccountRow, type CreateAccountInput } from "./lib/create-account";
import { getActiveAccountsForUser } from "./lib/repository";
import type { Account } from "./schema";

let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;
let mutations: WriteThroughMutationModule | null = null;

type AccountsState = {
  readonly accounts: readonly Account[];
};

type AccountsActions = {
  initStore: (db: AnyDb, userId: UserId) => void;
  refresh: () => Promise<void>;
  createAccount: (input: CreateAccountInput) => Promise<boolean>;
};

export const useAccountsStore = create<AccountsState & AccountsActions>((set, get) => ({
  accounts: [],

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    mutations = createWriteThroughMutationModule(db);
    set({ accounts: [] });
  },

  refresh: async () => {
    const db = dbRef;
    const userId = userIdRef;
    if (!db || !userId) return;

    try {
      set({ accounts: getActiveAccountsForUser(db, userId) });
    } catch {
      // Keep the existing snapshot on local DB read failures.
    }
  },

  createAccount: async (input) => {
    const userId = userIdRef;
    const mutationModule = mutations;
    if (!userId || !mutationModule) return false;

    const row = buildCreateAccountRow(input, userId);
    if (!row) return false;

    const result = await mutationModule.commit({
      kind: "account.save",
      row,
    });

    if (!result.success) return false;

    await get().refresh();
    return true;
  },
}));
