import { describe, expect, it } from "vitest";

const makeRow = (overrides = {}) => ({
  id: "tx-1",
  userId: "user-1",
  type: "expense",
  amount: 1000,
  categoryId: "food",
  description: "Coffee",
  date: "2026-03-10",
  createdAt: "2026-03-10T10:00:00.000Z",
  updatedAt: "2026-03-10T10:00:00.000Z",
  deletedAt: null,
  source: "manual",
  ...overrides,
});

describe("hasDataConflict", () => {
  it("returns false when all fields match", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow())).toBe(false);
  });

  it("returns false when only updatedAt differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow({ updatedAt: "2026-03-10T12:00:00.000Z" }))).toBe(
      false
    );
  });

  it("returns false when only source differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow({ source: "manual" }), makeRow({ source: "email" }))).toBe(
      false
    );
  });

  it("returns true when amount differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow({ amount: 2000 }))).toBe(true);
  });

  it("returns true when categoryId differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow({ categoryId: "transport" }))).toBe(true);
  });

  it("returns true when description differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow({ description: "Lunch" }))).toBe(true);
  });

  it("returns true when date differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow({ date: "2026-03-11" }))).toBe(true);
  });

  it("returns true when type differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow({ type: "income" }))).toBe(true);
  });

  it("returns true when deletedAt differs", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow(), makeRow({ deletedAt: "2026-03-10T15:00:00.000Z" }))).toBe(
      true
    );
  });

  it("returns false when both descriptions are null", async () => {
    const { hasDataConflict } = await import("@/features/sync/lib/conflict-detection");
    expect(hasDataConflict(makeRow({ description: null }), makeRow({ description: null }))).toBe(
      false
    );
  });
});
