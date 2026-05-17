// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn<(...args: any[]) => any>((_col, val) => ({ op: "eq", val })),
  and: vi.fn<(...args: any[]) => any>((...args: any[]) => ({ op: "and", args })),
  gte: vi.fn<(...args: any[]) => any>((_col, val) => ({ op: "gte", val })),
  lte: vi.fn<(...args: any[]) => any>((_col, val) => ({ op: "lte", val })),
  isNull: vi.fn<(...args: any[]) => any>((_col) => ({ op: "isNull" })),
}));

const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockFrom = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockWhere = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);

const mockDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
} as any;

const DISTINCT_FINGERPRINT_INPUTS = [
  { source: "email", amount: 5000, date: "2026-03-07", merchant: "Uber Eats" },
  { source: "email", amount: 9999, date: "2026-03-07", merchant: "Uber Eats" },
  { source: "notification", amount: 5000, date: "2026-03-07", merchant: "Uber Eats" },
  { source: "email", amount: 5000, date: "2026-03-08", merchant: "Uber Eats" },
  { source: "email", amount: 5000, date: "2026-03-07", merchant: "Starbucks" },
] as const;

describe("captureFingerprint", () => {
  it("returns a deterministic string for the same inputs", async () => {
    const { captureFingerprint } = await import("@/features/capture-sources/lib/dedup");

    const input = DISTINCT_FINGERPRINT_INPUTS[0];
    const a = captureFingerprint(input);
    const b = captureFingerprint(input);

    expect(a).toBe(b);
  });

  it("produces different output for different inputs", async () => {
    const { captureFingerprint } = await import("@/features/capture-sources/lib/dedup");

    const fingerprints = DISTINCT_FINGERPRINT_INPUTS.map((input) => captureFingerprint(input));

    expect(new Set(fingerprints).size).toBe(DISTINCT_FINGERPRINT_INPUTS.length);
  });

  it("normalizes merchant name (lowercase, trimmed, collapsed spaces)", async () => {
    const { captureFingerprint } = await import("@/features/capture-sources/lib/dedup");

    const a = captureFingerprint({
      source: "email",
      amount: 1000,
      date: "2026-03-07",
      merchant: "  Uber  Eats  ",
    });
    const b = captureFingerprint({
      source: "email",
      amount: 1000,
      date: "2026-03-07",
      merchant: "uber eats",
    });

    expect(a).toBe(b);
  });
});

describe("isCaptureProcessed", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockWhere.mockReset();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it("returns true when matching non-failed processed source event exists", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "pse-1", status: "processed" }]);

    const { isCaptureProcessed } = await import("@/features/capture-sources/lib/dedup");
    const result = await isCaptureProcessed({
      db: mockDb,
      userId: "user-1",
      sourceFamily: "notification",
      sourceId: "notification",
      sourceEventId: "fp-hash-123",
    });

    expect(result).toBe(true);
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it("does not block retries for failed processed source events", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "pse-1", status: "failed" }]).mockResolvedValueOnce([]);

    const { isCaptureProcessed } = await import("@/features/capture-sources/lib/dedup");
    const result = await isCaptureProcessed({
      db: mockDb,
      userId: "user-1",
      sourceFamily: "widget",
      sourceId: "widget",
      sourceEventId: "fp-hash-retry",
    });

    expect(result).toBe(false);
  });

  it("uses the processed source event semantic key for lookup", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { isCaptureProcessed } = await import("@/features/capture-sources/lib/dedup");
    await isCaptureProcessed({
      db: mockDb,
      userId: "user-1",
      sourceFamily: "notification",
      sourceId: "notification",
      sourceEventId: "fp-hash-123",
    });

    expect(mockWhere).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({ val: "user-1" }),
          expect.objectContaining({ val: "notification" }),
          expect.objectContaining({ val: "fp-hash-123" }),
          expect.objectContaining({ op: "isNull" }),
        ]),
      })
    );
  });

  it("returns false when fingerprint is not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { isCaptureProcessed } = await import("@/features/capture-sources/lib/dedup");
    const result = await isCaptureProcessed({
      db: mockDb,
      userId: "user-1",
      sourceFamily: "notification",
      sourceId: "notification",
      sourceEventId: "fp-hash-missing",
    });

    expect(result).toBe(false);
  });
});

describe("findDuplicateTransaction", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockWhere.mockReset();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it("returns transaction ID when counterparty match found (same amount + date + normalized merchant)", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-1", description: "Dinner with Ana", counterpartyName: "Uber Eats" },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "Uber Eats",
    });

    expect(result).toBe("tx-1");
  });

  it("returns null when no match exists", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "Uber Eats",
    });

    expect(result).toBeNull();
  });

  it("handles merchant normalization (case insensitive, trimmed)", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-2", description: "Lunch", counterpartyName: "  UBER   EATS  " },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "uber eats",
    });

    expect(result).toBe("tx-2");
  });

  it("returns null when amount+date match but merchant differs", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-3", description: "Coffee", counterpartyName: "Starbucks" },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "Uber Eats",
    });

    expect(result).toBeNull();
  });

  it("matches when DB description contains the incoming merchant (substring)", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-sub-1", description: "Checkup", counterpartyName: "BOLD Natural Medical" },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 100000,
      date: "2026-03-21",
      merchant: "Natural Medical",
    });

    expect(result).toBe("tx-sub-1");
  });

  it("matches when incoming merchant contains the DB description (substring)", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-sub-2", description: "Dinner", counterpartyName: "HARISSA" },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 160100,
      date: "2026-03-20",
      merchant: "HARISSA HF2",
    });

    expect(result).toBe("tx-sub-2");
  });

  it("does not substring-match when DB description is very short (< 3 chars)", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-short", description: "Note", counterpartyName: "AB" },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "ABC Store",
    });

    expect(result).toBeNull();
  });

  it("handles null description in DB row without false match", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "tx-null", description: null }]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "Uber Eats",
    });

    expect(result).toBeNull();
  });

  it("returns null without querying when incoming merchant is empty", async () => {
    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "   ",
    });

    expect(result).toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("does not match amount and date when stored counterparty is empty", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-empty-counterparty", description: null, counterpartyName: "   " },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "Uber Eats",
    });

    expect(result).toBeNull();
  });

  it("does not match user-authored description when counterparty is missing", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "tx-description-only", description: "Uber Eats", counterpartyName: null },
    ]);

    const { findDuplicateTransaction } = await import("@/features/capture-sources/lib/dedup");
    const result = await findDuplicateTransaction({
      db: mockDb,
      userId: "user-1",
      amount: 5000,
      date: "2026-03-07",
      merchant: "Uber Eats",
    });

    expect(result).toBeNull();
  });
});
