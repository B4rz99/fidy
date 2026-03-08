// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ op: "eq", val })),
  and: vi.fn((...args: any[]) => ({ op: "and", args })),
  gte: vi.fn((_col, val) => ({ op: "gte", val })),
  lte: vi.fn((_col, val) => ({ op: "lte", val })),
}));

const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);

const mockDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
} as any;

describe("captureFingerprint", () => {
  it("returns a deterministic string for the same inputs", async () => {
    const { captureFingerprint } = await import("@/features/capture-sources/lib/dedup");

    const a = captureFingerprint("email", 5000, "2026-03-07", "Uber Eats");
    const b = captureFingerprint("email", 5000, "2026-03-07", "Uber Eats");

    expect(a).toBe(b);
  });

  it("produces different output for different inputs", async () => {
    const { captureFingerprint } = await import("@/features/capture-sources/lib/dedup");

    const a = captureFingerprint("email", 5000, "2026-03-07", "Uber Eats");
    const b = captureFingerprint("email", 9999, "2026-03-07", "Uber Eats");
    const c = captureFingerprint("notification", 5000, "2026-03-07", "Uber Eats");
    const d = captureFingerprint("email", 5000, "2026-03-08", "Uber Eats");
    const e = captureFingerprint("email", 5000, "2026-03-07", "Starbucks");

    expect(new Set([a, b, c, d, e]).size).toBe(5);
  });

  it("normalizes merchant name (lowercase, trimmed, collapsed spaces)", async () => {
    const { captureFingerprint } = await import("@/features/capture-sources/lib/dedup");

    const a = captureFingerprint("email", 1000, "2026-03-07", "  Uber  Eats  ");
    const b = captureFingerprint("email", 1000, "2026-03-07", "uber eats");

    expect(a).toBe(b);
  });
});

describe("isCaptureProcessed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it("returns true when fingerprint exists in DB", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "pc-1" }]);

    const { isCaptureProcessed } = await import("@/features/capture-sources/lib/dedup");
    const result = await isCaptureProcessed(mockDb, "fp-hash-123");

    expect(result).toBe(true);
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it("returns false when fingerprint is not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { isCaptureProcessed } = await import("@/features/capture-sources/lib/dedup");
    const result = await isCaptureProcessed(mockDb, "fp-hash-missing");

    expect(result).toBe(false);
  });
});

describe("findDuplicateTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it("returns transaction ID when match found (same amount + date + normalized merchant)", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "tx-1", description: "Uber Eats" }]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction(
      mockDb,
      "user-1",
      5000,
      "2026-03-07",
      "Uber Eats"
    );

    expect(result).toBe("tx-1");
  });

  it("returns null when no match exists", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction(
      mockDb,
      "user-1",
      5000,
      "2026-03-07",
      "Uber Eats"
    );

    expect(result).toBeNull();
  });

  it("handles merchant normalization (case insensitive, trimmed)", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "tx-2", description: "  UBER   EATS  " }]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction(
      mockDb,
      "user-1",
      5000,
      "2026-03-07",
      "uber eats"
    );

    expect(result).toBe("tx-2");
  });

  it("returns null when amount+date match but merchant differs", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "tx-3", description: "Starbucks" }]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction(
      mockDb,
      "user-1",
      5000,
      "2026-03-07",
      "Uber Eats"
    );

    expect(result).toBeNull();
  });
});
