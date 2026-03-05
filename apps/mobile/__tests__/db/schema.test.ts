import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { syncMeta, syncQueue, transactions } from "@/shared/db/schema";

describe("transactions table schema", () => {
  it("is named 'transactions'", () => {
    expect(getTableName(transactions)).toBe("transactions");
  });

  it("has all required columns", () => {
    const cols = getTableColumns(transactions);
    const names = Object.keys(cols);

    expect(names).toContain("id");
    expect(names).toContain("userId");
    expect(names).toContain("type");
    expect(names).toContain("amountCents");
    expect(names).toContain("categoryId");
    expect(names).toContain("description");
    expect(names).toContain("date");
    expect(names).toContain("createdAt");
    expect(names).toContain("updatedAt");
    expect(names).toContain("deletedAt");
    expect(names).toHaveLength(11);
  });

  it("id is primary key", () => {
    const cols = getTableColumns(transactions);
    expect(cols.id.primary).toBe(true);
  });

  it("description is nullable", () => {
    const cols = getTableColumns(transactions);
    expect(cols.description.notNull).toBe(false);
  });

  it("deletedAt is nullable (soft delete)", () => {
    const cols = getTableColumns(transactions);
    expect(cols.deletedAt.notNull).toBe(false);
  });

  it("userId is not null", () => {
    const cols = getTableColumns(transactions);
    expect(cols.userId.notNull).toBe(true);
  });

  it("has source column", () => {
    expect(transactions.source).toBeDefined();
    expect(transactions.source.name).toBe("source");
  });
});

describe("syncQueue table schema", () => {
  it("is named 'sync_queue'", () => {
    expect(getTableName(syncQueue)).toBe("sync_queue");
  });

  it("has all required columns", () => {
    const cols = getTableColumns(syncQueue);
    const names = Object.keys(cols);

    expect(names).toContain("id");
    expect(names).toContain("tableName");
    expect(names).toContain("rowId");
    expect(names).toContain("operation");
    expect(names).toContain("createdAt");
    expect(names).toHaveLength(5);
  });
});

describe("syncMeta table schema", () => {
  it("is named 'sync_meta'", () => {
    expect(getTableName(syncMeta)).toBe("sync_meta");
  });

  it("has key and value columns", () => {
    const cols = getTableColumns(syncMeta);
    const names = Object.keys(cols);

    expect(names).toContain("key");
    expect(names).toContain("value");
    expect(names).toHaveLength(2);
  });

  it("key is primary key", () => {
    const cols = getTableColumns(syncMeta);
    expect(cols.key.primary).toBe(true);
  });
});
