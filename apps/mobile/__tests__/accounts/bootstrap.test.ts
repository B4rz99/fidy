// biome-ignore-all lint/suspicious/noExplicitAny: integration test needs a real SQLite DB
// biome-ignore-all lint/style/useNamingConvention: test mirrors raw SQLite column names
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import * as dbSchema from "@/shared/db/schema";

const tableInfoRowSchema = z.object({ name: z.string() });
const accountRowSchema = z.object({
  user_id: z.string(),
  system_key: z.string().nullable(),
  account_class: z.string(),
  account_subtype: z.string(),
  name: z.string(),
  institution: z.string(),
  baseline_amount: z.number(),
  baseline_date: z.string(),
  archived_at: z.string().nullable(),
});
const syncQueueRowSchema = z.object({
  table_name: z.string(),
  operation: z.string(),
  row_id: z.string(),
});

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1";
const FIXED_NOW = new Date("2026-04-13T12:00:00.000Z");
const rootLayoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
const onboardingSource = readFileSync(
  resolve(__dirname, "../../app/(auth)/onboarding.tsx"),
  "utf-8"
);

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

describe("accounts bootstrap", () => {
  it("exports an accounts table from the shared database schema", () => {
    expect(dbSchema).toHaveProperty("accounts");
  });

  it("creates the accounts table with baseline and archive columns in migrations", () => {
    const columns = z.array(tableInfoRowSchema).parse(sqlite.pragma("table_info(accounts)"));
    const columnNames = columns.map((column) => column.name);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "user_id",
        "system_key",
        "account_class",
        "account_subtype",
        "name",
        "institution",
        "baseline_amount",
        "baseline_date",
        "archived_at",
        "created_at",
        "updated_at",
      ])
    );
  });

  it("bootstraps default accounts in both onboarding and the authenticated app shell", () => {
    expect(rootLayoutSource).toContain("ensureDefaultAccounts(db, userId);");
    expect(onboardingSource).toContain("ensureDefaultAccounts(db, userId);");
  });

  it("seeds one default cash account and one default digital holding account per user", async () => {
    const moduleId = "@/features/accounts/lib/bootstrap";
    const mod = await import(moduleId).catch(() => null);

    expect(mod).not.toBeNull();
    if (!mod) return;

    const ids = ["acct-cash", "acct-digital", "acct-unused-1", "acct-unused-2"];
    const syncIds = ["sq-cash", "sq-digital", "sq-unused-1", "sq-unused-2"];
    const createId = () => {
      const nextId = ids.shift();
      if (!nextId) throw new Error("No more seeded ids available");
      return nextId;
    };
    const createSyncId = () => {
      const nextId = syncIds.shift();
      if (!nextId) throw new Error("No more sync ids available");
      return nextId;
    };

    await mod.ensureDefaultAccounts(db, USER_ID, {
      now: () => FIXED_NOW,
      createId,
      createSyncId,
    });
    await mod.ensureDefaultAccounts(db, USER_ID, {
      now: () => FIXED_NOW,
      createId,
      createSyncId,
    });

    const rows = z.array(accountRowSchema).parse(
      sqlite
        .prepare(
          `
            select
              user_id,
              system_key,
              account_class,
              account_subtype,
              name,
              institution,
              baseline_amount,
              baseline_date,
              archived_at
            from accounts
            where user_id = ?
            order by system_key
          `
        )
        .all(USER_ID)
    );

    expect(rows).toHaveLength(2);
    expect(rows).toEqual([
      {
        user_id: USER_ID,
        system_key: "default_cash",
        account_class: "asset",
        account_subtype: "cash",
        name: "Cash",
        institution: "Fidy",
        baseline_amount: 0,
        baseline_date: "2026-04-13",
        archived_at: null,
      },
      {
        user_id: USER_ID,
        system_key: "default_digital_holding",
        account_class: "asset",
        account_subtype: "digital_holding",
        name: "Digital Holding",
        institution: "Fidy",
        baseline_amount: 0,
        baseline_date: "2026-04-13",
        archived_at: null,
      },
    ]);

    const syncRows = z.array(syncQueueRowSchema).parse(
      sqlite
        .prepare(
          `
            select table_name, operation, row_id
            from sync_queue
            order by row_id
          `
        )
        .all()
    );

    expect(syncRows).toEqual([
      { table_name: "accounts", operation: "insert", row_id: "acct-cash" },
      { table_name: "accounts", operation: "insert", row_id: "acct-digital" },
    ]);
  });

  it("upserts default accounts by system key without rewriting createdAt", async () => {
    const mod = await import("@/features/accounts/lib/repository");
    const insertAccount = (db: unknown, row: Record<string, unknown>) =>
      Reflect.apply(Reflect.get(mod, "insertAccount"), mod, [db, row]);
    const upsertAccount = (db: unknown, row: Record<string, unknown>) =>
      Reflect.apply(Reflect.get(mod, "upsertAccount"), mod, [db, row]);
    const getAccountsBySystemKeys = (
      db: unknown,
      userId: string,
      systemKeys: readonly string[]
    ) => Reflect.apply(Reflect.get(mod, "getAccountsBySystemKeys"), mod, [db, userId, systemKeys]);

    insertAccount(db, {
      id: "acct-original",
      userId: USER_ID,
      systemKey: "default_cash",
      accountClass: "asset",
      accountSubtype: "cash",
      name: "Cash",
      institution: "Fidy",
      last4: null,
      baselineAmount: 0,
      baselineDate: "2026-04-13",
      creditLimit: null,
      closingDay: null,
      dueDay: null,
      archivedAt: null,
      createdAt: "2026-04-13T08:00:00.000Z",
      updatedAt: "2026-04-13T08:00:00.000Z",
    });

    upsertAccount(db, {
      id: "acct-replacement",
      userId: USER_ID,
      systemKey: "default_cash",
      accountClass: "asset",
      accountSubtype: "cash",
      name: "Updated Cash",
      institution: "Fidy",
      last4: null,
      baselineAmount: 0,
      baselineDate: "2026-04-13",
      creditLimit: null,
      closingDay: null,
      dueDay: null,
      archivedAt: null,
      createdAt: "2026-04-14T09:00:00.000Z",
      updatedAt: "2026-04-14T09:00:00.000Z",
    });

    expect(getAccountsBySystemKeys(db, USER_ID, ["default_cash"])).toEqual([
      expect.objectContaining({
        id: "acct-original",
        systemKey: "default_cash",
        name: "Updated Cash",
        createdAt: "2026-04-13T08:00:00.000Z",
        updatedAt: "2026-04-14T09:00:00.000Z",
      }),
    ]);
  });

  it("rejects invalid local enum and day-of-month values at the database layer", () => {
    expect(() =>
      sqlite
        .prepare(
          `
            insert into accounts (
              id, user_id, system_key, account_class, account_subtype, name, institution, last4,
              baseline_amount, baseline_date, credit_limit, closing_day, due_day, archived_at,
              created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          "acct-invalid-class",
          USER_ID,
          null,
          "weird",
          "cash",
          "Broken",
          "Fidy",
          null,
          0,
          "2026-04-13",
          null,
          null,
          null,
          null,
          "2026-04-13T08:00:00.000Z",
          "2026-04-13T08:00:00.000Z"
        )
    ).toThrow();

    expect(() =>
      sqlite
        .prepare(
          `
            insert into accounts (
              id, user_id, system_key, account_class, account_subtype, name, institution, last4,
              baseline_amount, baseline_date, credit_limit, closing_day, due_day, archived_at,
              created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          "acct-invalid-metadata",
          USER_ID,
          null,
          "asset",
          "cash",
          "Broken",
          "Fidy",
          "12ab",
          0,
          "2026-04-13",
          -1,
          0,
          32,
          null,
          "2026-04-13T08:00:00.000Z",
          "2026-04-13T08:00:00.000Z"
        )
    ).toThrow();
  });
});
