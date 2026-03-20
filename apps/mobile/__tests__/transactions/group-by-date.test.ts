import { describe, expect, it, vi } from "vitest";
import type { StoredTransaction } from "@/features/transactions/schema";

// Use real date-fns (global setup mocks it)
vi.unmock("date-fns");

function makeTx(overrides: Partial<StoredTransaction> & { date: Date }): StoredTransaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    userId: "user-1",
    type: "expense",
    amount: 1000,
    categoryId: "food",
    description: "Test",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe("buildListData", () => {
  it("returns empty items and stickyIndices for empty input", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const result = buildListData([]);

    expect(result.items).toEqual([]);
    expect(result.stickyIndices).toEqual([]);
  });

  it("returns one date header and one transaction for a single item", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const tx = makeTx({ date: new Date(2026, 2, 10) }); // March 10, 2026
    const result = buildListData([tx]);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ kind: "date-header" });
    expect(result.items[1]).toBe(tx);
    expect(result.stickyIndices).toEqual([0]);
  });

  it("groups multiple transactions on the same date under one header", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const tx1 = makeTx({ id: "tx-1", date: new Date(2026, 2, 10) });
    const tx2 = makeTx({ id: "tx-2", date: new Date(2026, 2, 10) });
    const result = buildListData([tx1, tx2]);

    expect(result.items).toHaveLength(3); // 1 header + 2 transactions
    expect(result.items[0]).toMatchObject({ kind: "date-header" });
    expect(result.items[1]).toBe(tx1);
    expect(result.items[2]).toBe(tx2);
    expect(result.stickyIndices).toEqual([0]);
  });

  it("creates separate headers for different dates", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const tx1 = makeTx({ id: "tx-1", date: new Date(2026, 2, 14) });
    const tx2 = makeTx({ id: "tx-2", date: new Date(2026, 2, 13) });
    const result = buildListData([tx1, tx2]);

    // header1, tx1, header2, tx2
    expect(result.items).toHaveLength(4);
    expect(result.items[0]).toMatchObject({ kind: "date-header" });
    expect(result.items[1]).toBe(tx1);
    expect(result.items[2]).toMatchObject({ kind: "date-header" });
    expect(result.items[3]).toBe(tx2);
    expect(result.stickyIndices).toEqual([0, 2]);
  });

  it("labels today's date as 'Today'", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const tx = makeTx({ date: new Date() });
    const result = buildListData([tx]);

    expect(result.items[0]).toMatchObject({
      kind: "date-header",
      label: "Today",
    });
  });

  it("labels yesterday's date as 'Yesterday'", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tx = makeTx({ date: yesterday });
    const result = buildListData([tx]);

    expect(result.items[0]).toMatchObject({
      kind: "date-header",
      label: "Yesterday",
    });
  });

  it("formats older dates as 'Month day'", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const tx = makeTx({ date: new Date(2026, 0, 15) }); // Jan 15, 2026
    const result = buildListData([tx]);

    expect(result.items[0]).toMatchObject({
      kind: "date-header",
      label: "January 15",
    });
  });

  it("computes stickyIndices correctly for multiple date groups", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const tx1 = makeTx({ id: "tx-1", date: new Date(2026, 2, 14) });
    const tx2 = makeTx({ id: "tx-2", date: new Date(2026, 2, 14) });
    const tx3 = makeTx({ id: "tx-3", date: new Date(2026, 2, 13) });
    const tx4 = makeTx({ id: "tx-4", date: new Date(2026, 2, 12) });
    const result = buildListData([tx1, tx2, tx3, tx4]);

    // [header@0, tx1, tx2, header@3, tx3, header@5, tx4]
    expect(result.stickyIndices).toEqual([0, 3, 5]);
  });

  it("does not mutate the input array", async () => {
    const { buildListData } = await import("@/features/transactions/lib/group-by-date");
    const tx1 = makeTx({ id: "tx-1", date: new Date(2026, 2, 14) });
    const tx2 = makeTx({ id: "tx-2", date: new Date(2026, 2, 13) });
    const input = [tx1, tx2];
    const inputCopy = [...input];

    buildListData(input);

    expect(input).toEqual(inputCopy);
  });
});

describe("isDateHeader", () => {
  it("returns true for date header objects", async () => {
    const { isDateHeader } = await import("@/features/transactions/lib/group-by-date");
    expect(isDateHeader({ kind: "date-header", label: "Today", dateKey: "2026-03-14" })).toBe(true);
  });

  it("returns false for transaction objects", async () => {
    const { isDateHeader } = await import("@/features/transactions/lib/group-by-date");
    const tx = makeTx({ date: new Date() });
    expect(isDateHeader(tx)).toBe(false);
  });
});
