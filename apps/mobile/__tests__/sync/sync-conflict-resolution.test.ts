// biome-ignore-all lint/suspicious/noExplicitAny: integration test needs flexible typing
// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names
// biome-ignore-all lint/style/noNonNullAssertion: assertions guard nullability before access
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getUnresolvedConflicts, insertConflict } from "@/features/sync/lib/conflict-repository";
import { resolveConflict } from "@/features/sync/services/sync";
import {
  getQueuedSyncEntries,
  getTransactionById,
  initializeTransactionSession,
  insertTransaction,
} from "@/features/transactions";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
  initializeTransactionSession("user-1" as UserId);
});

afterEach(() => {
  sqlite.close();
});

function insertLocalTx(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "tx-1" as TransactionId,
    userId: "user-1" as UserId,
    type: "expense",
    amount: 1000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Local merchant",
    date: "2026-03-10" as IsoDate,
    createdAt: "2026-03-10T08:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-10T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    source: "manual",
    ...overrides,
  };
  insertTransaction(db as any, row as any);
}

function conflictRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "conflict-1",
    transactionId: "tx-1",
    localData: JSON.stringify({
      id: "tx-1",
      userId: "user-1",
      type: "expense",
      amount: 1000,
      categoryId: "food",
      description: "Local merchant",
      date: "2026-03-10",
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T10:00:00.000Z",
      deletedAt: null,
      source: "manual",
    }),
    serverData: JSON.stringify({
      id: "tx-1",
      userId: "user-1",
      type: "expense",
      amount: 2000,
      categoryId: "food",
      description: "Server merchant",
      date: "2026-03-10",
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T14:00:00.000Z",
      deletedAt: null,
      source: "email",
    }),
    detectedAt: "2026-03-15T10:00:00.000Z",
    resolvedAt: null,
    resolution: null,
    ...overrides,
  };
}

describe("sync conflict resolution boundary", () => {
  it("keeps local data and re-enqueues sync when resolving in favor of local", async () => {
    insertLocalTx();
    insertConflict(db as any, conflictRow() as any);

    await resolveConflict({
      db: db as any,
      conflictId: "conflict-1" as any,
      resolution: "local",
    });

    const tx = getTransactionById(db as any, "tx-1" as TransactionId);
    expect(tx?.amount).toBe(1000);

    const queue = getQueuedSyncEntries(db as any);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.tableName).toBe("transactions");
    expect(queue[0]?.rowId).toBe("tx-1");

    const conflicts = getUnresolvedConflicts(db as any);
    expect(conflicts).toHaveLength(0);
  });

  it("marks the conflict resolved without re-enqueueing when accepting server data", async () => {
    insertLocalTx({ amount: 1200 });
    insertConflict(db as any, conflictRow() as any);

    await resolveConflict({
      db: db as any,
      conflictId: "conflict-1" as any,
      resolution: "server",
    });

    const tx = getTransactionById(db as any, "tx-1" as TransactionId);
    expect(tx?.amount).toBe(1200);

    const queue = getQueuedSyncEntries(db as any);
    expect(queue).toHaveLength(0);

    const conflicts = getUnresolvedConflicts(db as any);
    expect(conflicts).toHaveLength(0);
  });
});
