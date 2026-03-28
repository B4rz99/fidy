/**
 * Integration test for syncPull using a real SQLite database.
 *
 * Unlike the unit tests that mock every repository call, this test verifies:
 * - Column mapping (fromSupabaseRow / toSupabaseRow) works against real schema
 * - LWW conflict detection + logging with actual DB rows
 * - Cursor advancement (syncMeta) with real upserts
 * - The full flow: pull server rows → compare → upsert → log conflict
 */
// biome-ignore-all lint/suspicious/noExplicitAny: integration test needs flexible typing
// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names
// biome-ignore-all lint/style/noNonNullAssertion: assertions guard nullability before access

import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/sentry", () => ({
  captureError: vi.fn(),
  capturePipelineEvent: vi.fn(),
  captureWarning: vi.fn(),
}));

import { getUnresolvedConflicts } from "@/features/sync/lib/conflict-repository";
import { syncPull } from "@/features/sync/services/syncEngine";
import {
  getSyncMeta,
  getTransactionById,
  insertTransaction,
} from "@/features/transactions/lib/repository";
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
  vi.clearAllMocks();

  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "user-integration-1";

/** Build a snake_case server row (what Supabase returns). */
function serverRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx-1",
    user_id: USER_ID,
    type: "expense",
    amount: 2000,
    category_id: "food",
    description: "Server merchant",
    date: "2026-03-10",
    created_at: "2026-03-10T10:00:00.000Z",
    updated_at: "2026-03-10T14:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

/** Insert a camelCase local transaction directly via the repository. */
function insertLocalTx(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "tx-1" as TransactionId,
    userId: USER_ID as UserId,
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
  insertTransaction(db as any, row);
  return row;
}

/**
 * Build a chainable mock that mirrors the Supabase PostgREST query shape
 * used by syncPull: .from().select().eq().gte?().order().limit()
 */
function mockSupabase(rows: Record<string, unknown>[]) {
  const result = { data: rows, error: null };
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  return chain as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("syncPull integration (real SQLite)", () => {
  it("server newer → upserts and logs conflict", async () => {
    insertLocalTx({ amount: 1000, updatedAt: "2026-03-10T10:00:00.000Z" });

    const supabase = mockSupabase([
      serverRow({ amount: 2000, updated_at: "2026-03-10T14:00:00.000Z" }),
    ]);

    const ok = await syncPull(db as any, supabase, USER_ID);
    expect(ok).toBe(true);

    // Local row should now have the server's amount
    const tx = getTransactionById(db as any, "tx-1" as TransactionId);
    expect(tx).not.toBeNull();
    expect(tx?.amount).toBe(2000);

    // A conflict should be logged
    const conflicts = getUnresolvedConflicts(db as any);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.transactionId).toBe("tx-1");

    const localData = JSON.parse(conflicts[0]?.localData ?? "{}");
    const serverData = JSON.parse(conflicts[0]?.serverData ?? "{}");
    expect(localData.amount).toBe(1000);
    expect(serverData.amount).toBe(2000);
  });

  it("local newer → preserved, no conflict", async () => {
    insertLocalTx({ amount: 1000, updatedAt: "2026-03-10T14:00:00.000Z" });

    const supabase = mockSupabase([
      serverRow({ amount: 2000, updated_at: "2026-03-10T10:00:00.000Z" }),
    ]);

    const ok = await syncPull(db as any, supabase, USER_ID);
    expect(ok).toBe(true);

    // Local data should be unchanged
    const tx = getTransactionById(db as any, "tx-1" as TransactionId);
    expect(tx?.amount).toBe(1000);
    expect(tx?.description).toBe("Local merchant");

    // No conflicts
    const conflicts = getUnresolvedConflicts(db as any);
    expect(conflicts).toHaveLength(0);
  });

  it("new server-only row → inserted, no conflict", async () => {
    const supabase = mockSupabase([serverRow({ id: "tx-new", description: "Cloud-only" })]);

    const ok = await syncPull(db as any, supabase, USER_ID);
    expect(ok).toBe(true);

    const tx = getTransactionById(db as any, "tx-new" as TransactionId);
    expect(tx).not.toBeNull();
    expect(tx?.description).toBe("Cloud-only");
    expect(tx?.amount).toBe(2000);

    const conflicts = getUnresolvedConflicts(db as any);
    expect(conflicts).toHaveLength(0);
  });

  it("same data, newer timestamp → upserts without conflict", async () => {
    insertLocalTx({
      amount: 2000,
      categoryId: "food",
      description: "Server merchant",
      date: "2026-03-10",
      type: "expense",
      deletedAt: null,
      updatedAt: "2026-03-10T10:00:00.000Z",
    });

    const supabase = mockSupabase([
      serverRow({
        amount: 2000,
        category_id: "food",
        description: "Server merchant",
        date: "2026-03-10",
        type: "expense",
        deleted_at: null,
        updated_at: "2026-03-10T14:00:00.000Z",
      }),
    ]);

    const ok = await syncPull(db as any, supabase, USER_ID);
    expect(ok).toBe(true);

    // Timestamp should be updated
    const tx = getTransactionById(db as any, "tx-1" as TransactionId);
    expect(tx?.updatedAt).toBe("2026-03-10T14:00:00.000Z");

    // No conflict since data is identical
    const conflicts = getUnresolvedConflicts(db as any);
    expect(conflicts).toHaveLength(0);
  });

  it("cursor advancement → syncMeta updated to max updated_at", async () => {
    const supabase = mockSupabase([
      serverRow({ id: "tx-a", updated_at: "2026-03-10T12:00:00.000Z" }),
      serverRow({ id: "tx-b", updated_at: "2026-03-10T16:00:00.000Z" }),
    ]);

    const ok = await syncPull(db as any, supabase, USER_ID);
    expect(ok).toBe(true);

    const cursor = getSyncMeta(db as any, "last_sync_at");
    expect(cursor).toBe("2026-03-10T16:00:00.000Z");
  });
});
