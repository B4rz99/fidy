// biome-ignore-all lint/suspicious/noExplicitAny: integration test needs a real SQLite DB
// biome-ignore-all lint/style/useNamingConvention: test mirrors raw SQLite column names
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ensureDefaultAccounts } from "@/features/accounts";

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
      initStore: (db: unknown, userId: string) => void;
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

const accountRowSchema = z.object({
  id: z.string(),
  system_key: z.string().nullable(),
  account_class: z.string(),
  account_subtype: z.string(),
  name: z.string(),
  institution: z.string(),
  last4: z.string().nullable(),
  baseline_amount: z.number(),
  baseline_date: z.string(),
  credit_limit: z.number().nullable(),
  closing_day: z.number().nullable(),
  due_day: z.number().nullable(),
});
const syncQueueInsertSchema = z.object({
  table_name: z.string(),
  operation: z.string(),
  row_id: z.string(),
});
const creditCardDaySchema = z.object({
  closing_day: z.number().nullable(),
  due_day: z.number().nullable(),
});

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-accounts-1";

const seedDefaultAccounts = (database: unknown, userId: string) => {
  Reflect.apply(ensureDefaultAccounts, undefined, [database, userId]);
};

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
    seedDefaultAccounts(db, USER_ID);

    const moduleId = "@/features/accounts/store";
    const mod: AccountsStoreModule | null = await import(moduleId).catch(() => null);

    expect(mod).not.toBeNull();
    if (!mod) return;

    mod.useAccountsStore.getState().initStore(db, USER_ID);
    await mod.useAccountsStore.getState().refresh();

    expect(mod.useAccountsStore.getState().accounts.length).toBe(2);

    const nextSqlite = new Database(":memory:");
    const nextDb = drizzle(nextSqlite);
    migrate(nextDb, { migrationsFolder: resolve(__dirname, "../../drizzle") });

    mod.useAccountsStore.getState().initStore(nextDb, "user-accounts-2");

    expect(mod.useAccountsStore.getState().accounts).toEqual([]);

    nextSqlite.close();
  });

  it("creates a new financial account and refreshes the active account list", async () => {
    seedDefaultAccounts(db, USER_ID);

    const moduleId = "@/features/accounts/store";
    const mod: AccountsStoreModule | null = await import(moduleId).catch(() => null);

    expect(mod).not.toBeNull();
    if (!mod) return;

    mod.useAccountsStore.getState().initStore(db, USER_ID);
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

    const row = accountRowSchema.optional().parse(
      sqlite
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
        .get(USER_ID, "Visa Gold")
    );

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

    const syncRow = syncQueueInsertSchema.optional().parse(
      sqlite
        .prepare(
          `
            select table_name, operation, row_id
            from sync_queue
            where table_name = 'accounts' and row_id = ?
          `
        )
        .get(row?.id)
    );

    expect(syncRow).toEqual({
      table_name: "accounts",
      operation: "insert",
      row_id: row?.id,
    });
  });

  it("ignores stale credit-card schedule fields when creating a non-credit-card account", async () => {
    seedDefaultAccounts(db, USER_ID);

    const moduleId = "@/features/accounts/store";
    const mod: AccountsStoreModule | null = await import(moduleId).catch(() => null);

    expect(mod).not.toBeNull();
    if (!mod) return;

    mod.useAccountsStore.getState().initStore(db, USER_ID);

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

    const row = creditCardDaySchema.optional().parse(
      sqlite
        .prepare(
          `
            select closing_day, due_day
            from accounts
            where user_id = ? and name = ?
          `
        )
        .get(USER_ID, "Everyday Checking")
    );

    expect(row).toEqual({
      closing_day: null,
      due_day: null,
    });
  });

  it("does not refresh a newer session when an earlier createAccount finishes late", async () => {
    seedDefaultAccounts(db, USER_ID);

    const nextSqlite = new Database(":memory:");
    const nextDb = drizzle(nextSqlite);
    migrate(nextDb, { migrationsFolder: resolve(__dirname, "../../drizzle") });
    seedDefaultAccounts(nextDb, "user-accounts-2");

    const deferred = {
      resolve: null as ((value: { success: true }) => void) | null,
    };
    const commit = vi.fn(
      () =>
        new Promise<{ success: true }>((resolve) => {
          deferred.resolve = resolve;
        })
    );

    vi.resetModules();
    vi.doMock("@/shared/mutations", () => ({
      createWriteThroughMutationModule: () => ({ commit }),
    }));

    const moduleId = "@/features/accounts/store";
    const mod: AccountsStoreModule | null = await import(moduleId).catch(() => null);

    expect(mod).not.toBeNull();
    if (!mod) {
      nextSqlite.close();
      return;
    }

    mod.useAccountsStore.getState().initStore(db, USER_ID);
    await mod.useAccountsStore.getState().refresh();
    expect(mod.useAccountsStore.getState().accounts.length).toBe(2);

    const pendingCreate = mod.useAccountsStore.getState().createAccount({
      subtype: "checking",
      name: "Race Account",
      institution: "Nu",
      balanceDigits: "1000",
      balanceDate: new Date(2026, 3, 12),
    });

    mod.useAccountsStore.getState().initStore(nextDb, "user-accounts-2");
    expect(mod.useAccountsStore.getState().accounts).toEqual([]);

    expect(deferred.resolve).not.toBeNull();
    if (!deferred.resolve) throw new Error("Commit resolver was not captured");
    deferred.resolve({ success: true });

    await expect(pendingCreate).resolves.toBe(true);
    expect(mod.useAccountsStore.getState().accounts).toEqual([]);

    vi.doUnmock("@/shared/mutations");
    vi.resetModules();
    nextSqlite.close();
  });
});
