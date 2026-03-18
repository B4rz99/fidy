import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, test } from "vitest";
import { getUnsyncedCount } from "@/features/settings/lib/check-unsynced";
import type { AnyDb } from "@/shared/db";

describe("getUnsyncedCount", () => {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite) as unknown as AnyDb;

  beforeEach(() => {
    sqlite.exec("DROP TABLE IF EXISTS sync_queue");
    sqlite.exec(`
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  });

  test("returns 0 when sync queue is empty", () => {
    expect(getUnsyncedCount(db)).toBe(0);
  });

  test("returns correct count when items exist", () => {
    sqlite.exec(`
      INSERT INTO sync_queue (id, table_name, row_id, operation, created_at) VALUES
        ('1', 'transactions', 'tx1', 'insert', '2024-01-01'),
        ('2', 'transactions', 'tx2', 'update', '2024-01-01'),
        ('3', 'transactions', 'tx3', 'delete', '2024-01-01')
    `);
    expect(getUnsyncedCount(db)).toBe(3);
  });
});
