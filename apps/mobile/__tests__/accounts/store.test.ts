// biome-ignore-all lint/suspicious/noExplicitAny: integration test needs a real SQLite DB
// biome-ignore-all lint/style/useNamingConvention: test mirrors raw SQLite column names
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDefaultAccounts } from "@/features/accounts";
import type { UserId } from "@/shared/types/branded";

type AccountsStoreModule = {
  useAccountsStore: {
    getState: () => {
      accounts: readonly {
        id: string;
        name: string;
        institution: string;
        accountClass: string;
        accountSubtype: string;
      }[];
      initStore: (db: unknown, userId: UserId) => void;
      refresh: () => Promise<void>;
      createAccount: (input: {
        subtype: string;
        name: string;
        institution: string;
        last4?: string;
        balanceDigits: string;
        balanceDate: Date;
        creditLimitDigits?: string;
        closingDay?: string;
        dueDay?: string;
      }) => Promise<boolean>;
    };
  };
};

type AccountRow = {
  id: string;
  system_key: string | null;
  account_class: string;
  account_subtype: string;
  name: string;
  institution: string;
  last4: string | null;
  baseline_amount: number;
  baseline_date: string;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
};

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-accounts-1" as UserId;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

describe("accounts store", () => {
  it("clears the previous account snapshot when initStore switches sessions", async () => {
    ensureDefaultAccounts(db as any, USER_ID);

    const moduleId = "@/features/accounts/store";
    const mod = (await import(moduleId).catch(() => null)) as AccountsStoreModule | null;

    expect(mod).not.toBeNull();
    if (!mod) return;

    mod.useAccountsStore.getState().initStore(db as any, USER_ID);
    await mod.useAccountsStore.getState().refresh();

    expect(mod.useAccountsStore.getState().accounts.length).toBe(2);

    const nextSqlite = new Database(":memory:");
    const nextDb = drizzle(nextSqlite);
    migrate(nextDb, { migrationsFolder: resolve(__dirname, "../../drizzle") });

    mod.useAccountsStore.getState().initStore(nextDb as any, "user-accounts-2" as UserId);

    expect(mod.useAccountsStore.getState().accounts).toEqual([]);

    nextSqlite.close();
  });

  it("creates a new financial account and refreshes the active account list", async () => {
    ensureDefaultAccounts(db as any, USER_ID);

    const moduleId = "@/features/accounts/store";
    const mod = (await import(moduleId).catch(() => null)) as AccountsStoreModule | null;

    expect(mod).not.toBeNull();
    if (!mod) return;

    mod.useAccountsStore.getState().initStore(db as any, USER_ID);
    await mod.useAccountsStore.getState().refresh();

    expect(
      mod.useAccountsStore
        .getState()
        .accounts.map((account) => account.name)
        .sort()
    ).toEqual(["Cash", "Digital Holding"]);

    const success = await mod.useAccountsStore.getState().createAccount({
      subtype: "credit_card",
      name: "Visa Gold",
      institution: "Bancolombia",
      last4: "4242",
      balanceDigits: "250000",
      balanceDate: new Date(2026, 3, 12),
      creditLimitDigits: "1500000",
      closingDay: "25",
      dueDay: "5",
    });

    expect(success).toBe(true);
    expect(
      mod.useAccountsStore
        .getState()
        .accounts.map((account) => account.name)
        .sort()
    ).toEqual(["Cash", "Digital Holding", "Visa Gold"]);

    const row = sqlite
      .prepare(
        `
          select
            id,
            system_key,
            account_class,
            account_subtype,
            name,
            institution,
            last4,
            baseline_amount,
            baseline_date,
            credit_limit,
            closing_day,
            due_day
          from accounts
          where user_id = ? and name = ?
        `
      )
      .get(USER_ID, "Visa Gold") as AccountRow | undefined;

    expect(row).toMatchObject({
      system_key: null,
      account_class: "liability",
      account_subtype: "credit_card",
      name: "Visa Gold",
      institution: "Bancolombia",
      last4: "4242",
      baseline_amount: 250000,
      baseline_date: "2026-04-12",
      credit_limit: 1500000,
      closing_day: 25,
      due_day: 5,
    });
    expect(row?.id).toBeTruthy();

    const syncRow = sqlite
      .prepare(
        `
          select table_name, operation, row_id
          from sync_queue
          where table_name = 'accounts' and row_id = ?
        `
      )
      .get(row?.id) as { table_name: string; operation: string; row_id: string } | undefined;

    expect(syncRow).toEqual({
      table_name: "accounts",
      operation: "insert",
      row_id: row?.id,
    });
  });

  it("ignores stale credit-card schedule fields when creating a non-credit-card account", async () => {
    ensureDefaultAccounts(db as any, USER_ID);

    const moduleId = "@/features/accounts/store";
    const mod = (await import(moduleId).catch(() => null)) as AccountsStoreModule | null;

    expect(mod).not.toBeNull();
    if (!mod) return;

    mod.useAccountsStore.getState().initStore(db as any, USER_ID);

    const success = await mod.useAccountsStore.getState().createAccount({
      subtype: "checking",
      name: "Everyday Checking",
      institution: "Nu",
      balanceDigits: "100000",
      balanceDate: new Date(2026, 3, 12),
      closingDay: "99",
      dueDay: "00",
    });

    expect(success).toBe(true);

    const row = sqlite
      .prepare(
        `
          select closing_day, due_day
          from accounts
          where user_id = ? and name = ?
        `
      )
      .get(USER_ID, "Everyday Checking") as
      | { closing_day: number | null; due_day: number | null }
      | undefined;

    expect(row).toEqual({
      closing_day: null,
      due_day: null,
    });
  });
});
