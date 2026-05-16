// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing

import { beforeEach, describe, expect, it, vi } from "vitest";
import { processWidgetTransactions } from "@/features/capture-sources/services/widget-pipeline";
import type { UserId } from "@/shared/types/branded";

const mockInsertTransaction = vi.fn<(...args: any[]) => any>();
const mockIsCaptureProcessed = vi.fn<(...args: any[]) => any>();
const mockFindDuplicateTransaction = vi.fn<(...args: any[]) => any>();
const mockPersistProcessedSourceEvent = vi.fn<(...args: any[]) => any>();
const mockPersistCommittedCaptureSourceEvent = vi.fn<(...args: any[]) => any>();
const mockPersistCommittedCaptureSourceEventInTransaction = vi.fn<(...args: any[]) => any>();
const mockRecordAutomatedTransactionWithLocalLedger = vi.fn<(...args: any[]) => any>();
const mockGetPendingTransactions = vi.fn<(...args: any[]) => any>();
const mockRemovePendingTransactions = vi.fn<(...args: any[]) => any>();
const mockIsAvailable = vi.fn<(...args: any[]) => any>();
const mockGenerateProcessedCaptureId = vi.fn<(...args: any[]) => any>();
const mockEnsureDefaultFinancialAccount = vi.fn<(...args: any[]) => any>().mockReturnValue({
  id: "fa-default-user-1",
});
type CaptureFingerprintArgs = readonly [string, number, string, string];

const buildFingerprint = ([source, amount, date, merchant]: CaptureFingerprintArgs) =>
  `fp:${source}:${amount}:${date}:${merchant}`;

function mockRecordedWidgetTransaction(input: any) {
  const { command } = input;
  mockInsertTransaction(input.db, {
    id: input.transactionId,
    userId: command.userId,
    type: command.type,
    amount: command.amount,
    categoryId: command.categoryId,
    description: command.description,
    date: command.occurredOn,
    source: command.source,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: any[]) => mockInsertTransaction(...args),
}));

vi.mock("@/features/financial-accounts/public", () => ({
  ensureDefaultFinancialAccount: (...args: any[]) => mockEnsureDefaultFinancialAccount(...args),
}));

vi.mock("@/infrastructure/local-ledger/record-transaction", () => ({
  recordAutomatedTransactionWithLocalLedger: (...args: any[]) =>
    mockRecordAutomatedTransactionWithLocalLedger(...args),
}));

vi.mock("@/infrastructure/local-ledger/source-events", () => ({
  persistProcessedSourceEvent: (...args: any[]) => mockPersistProcessedSourceEvent(...args),
  persistCommittedCaptureSourceEvent: (...args: any[]) =>
    mockPersistCommittedCaptureSourceEvent(...args),
  persistCommittedCaptureSourceEventInTransaction: (...args: any[]) =>
    mockPersistCommittedCaptureSourceEventInTransaction(...args),
}));

vi.mock("@/features/transactions/lib/categories", () => ({
  isValidCategoryId: (id: string) =>
    [
      "food",
      "transport",
      "entertainment",
      "health",
      "education",
      "home",
      "clothing",
      "services",
      "other",
    ].includes(id),
}));

vi.mock("@/features/capture-sources/lib/dedup", () => ({
  isCaptureProcessed: (...args: any[]) => mockIsCaptureProcessed(...args),
  findDuplicateTransaction: (...args: any[]) => mockFindDuplicateTransaction(...args),
  captureFingerprint: (...args: CaptureFingerprintArgs) => buildFingerprint(args),
}));

vi.mock("@/modules/expo-app-intents", () => ({
  getPendingTransactions: (...args: any[]) => mockGetPendingTransactions(...args),
  removePendingTransactions: (...args: any[]) => mockRemovePendingTransactions(...args),
  isAvailable: () => mockIsAvailable(),
}));

vi.mock("@/shared/lib", () => ({
  captureError: vi.fn<(...args: any[]) => any>(),
  capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
  captureWarning: vi.fn<(...args: any[]) => any>(),
  generateProcessedCaptureId: () => mockGenerateProcessedCaptureId(),
  toIsoDate: (d: Date) => d.toISOString().slice(0, 10),
  toIsoDateTime: (d: Date) => d.toISOString(),
  trackTransactionCreated: vi.fn<(...args: any[]) => any>(),
}));

const mockDb = {} as any;
const USER_ID = "user-1" as UserId;

describe("processWidgetTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAvailable.mockReturnValue(true);
    mockGetPendingTransactions.mockResolvedValue([]);
    mockRemovePendingTransactions.mockResolvedValue(undefined);
    mockIsCaptureProcessed.mockResolvedValue(false);
    mockFindDuplicateTransaction.mockResolvedValue(null);
    mockGenerateProcessedCaptureId.mockReturnValue("pc-1");
    mockEnsureDefaultFinancialAccount.mockReturnValue({ id: "fa-default-user-1" });
    mockPersistProcessedSourceEvent.mockReturnValue(undefined);
    mockPersistCommittedCaptureSourceEvent.mockReturnValue(undefined);
    mockPersistCommittedCaptureSourceEventInTransaction.mockReturnValue(undefined);
    mockRecordAutomatedTransactionWithLocalLedger.mockImplementation(async (input: any) => {
      input.afterRecord?.(input.db, { id: input.transactionId });
      mockRecordedWidgetTransaction(input);
      return { success: true, transaction: { id: input.transactionId } };
    });
  });

  it("early-returns when isAvailable() is false", async () => {
    mockIsAvailable.mockReturnValue(false);

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(mockGetPendingTransactions).not.toHaveBeenCalled();
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(result).toEqual({ saved: 0, skippedDuplicate: 0, errors: 0 });
  });

  it("early-returns when pending list is empty", async () => {
    mockGetPendingTransactions.mockResolvedValue([]);

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockRemovePendingTransactions).not.toHaveBeenCalled();
    expect(result).toEqual({ saved: 0, skippedDuplicate: 0, errors: 0 });
  });

  it("saves a single pending transaction through the automated ledger source", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "abc-123", amount: 25000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledOnce();
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        id: "txn-widget-abc-123",
        userId: USER_ID,
        type: "expense",
        amount: 25000,
        categoryId: "other",
        description: "",
        source: "automated",
      })
    );
    expect(result.saved).toBe(1);
  });

  it("derives deterministic transaction ID from widget entry ID", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "stable-uuid", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ id: "txn-widget-stable-uuid" })
    );
  });

  it("removes all processed entry IDs after success", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "id-a", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
      { id: "id-b", amount: 20000, createdAt: "2026-03-27T11:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledTimes(2);
    expect(mockRemovePendingTransactions).toHaveBeenCalledWith(["id-a", "id-b"]);
  });

  it("processes multiple pending transactions with unique IDs", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "uuid-1", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
      { id: "uuid-2", amount: 20000, createdAt: "2026-03-27T11:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    const firstTxCall = mockInsertTransaction.mock.calls[0]![1];
    const secondTxCall = mockInsertTransaction.mock.calls[1]![1];
    expect(firstTxCall.id).toBe("txn-widget-uuid-1");
    expect(secondTxCall.id).toBe("txn-widget-uuid-2");
    expect(firstTxCall.amount).toBe(10000);
    expect(secondTxCall.amount).toBe(20000);
  });

  it("derives transaction date from item.createdAt", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "date-test", amount: 5000, createdAt: "2026-03-15T14:30:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        date: "2026-03-15",
      })
    );
  });

  it("rounds fractional amounts to nearest integer", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "round-test", amount: 15000.7, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ amount: 15001 })
    );
  });

  it("uses category from pending item when valid", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "cat-test", amount: 8000, createdAt: "2026-03-27T10:00:00Z", category: "food" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "food" })
    );
  });

  it("falls back to 'other' when category is invalid", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "bad-cat", amount: 5000, createdAt: "2026-03-27T10:00:00Z", category: "invalid" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "other" })
    );
  });

  it("falls back to 'other' for stale transfer widget categories", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "transfer-cat", amount: 5000, createdAt: "2026-03-27T10:00:00Z", category: "transfer" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "other" })
    );
  });

  it("uses type=income when specified", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "income-test", amount: 50000, createdAt: "2026-03-27T10:00:00Z", type: "income" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ type: "income" })
    );
  });

  it("uses description from pending item", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      {
        id: "desc-test",
        amount: 12000,
        createdAt: "2026-03-27T10:00:00Z",
        description: "Coffee at Juan Valdez",
      },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ description: "Coffee at Juan Valdez" })
    );
  });

  it("defaults optional fields when absent", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "compat-test", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        type: "expense",
        categoryId: "other",
        description: "",
      })
    );
  });

  it("skips already-processed entries (fingerprint dedup)", async () => {
    mockIsCaptureProcessed.mockResolvedValue(true);
    mockGetPendingTransactions.mockResolvedValue([
      { id: "seen-before", amount: 5000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(result.skippedDuplicate).toBe(1);
    expect(mockPersistProcessedSourceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processed", failureReason: "already_processed_duplicate" })
    );
    expect(mockRemovePendingTransactions).toHaveBeenCalledWith(["seen-before"]);
  });

  it("skips entries that match an existing transaction (cross-source dedup)", async () => {
    mockFindDuplicateTransaction.mockResolvedValue("txn-existing-1");
    mockGetPendingTransactions.mockResolvedValue([
      { id: "dup-entry", amount: 5000, createdAt: "2026-03-27T10:00:00Z", description: "Coffee" },
    ]);

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(result.skippedDuplicate).toBe(1);
    expect(mockPersistProcessedSourceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processed",
        failureReason: "duplicate:txn-existing-1",
      })
    );
  });

  it("records processed capture on success inside the ledger transaction", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "cap-test", amount: 7000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockPersistCommittedCaptureSourceEvent).not.toHaveBeenCalled();
    expect(mockPersistCommittedCaptureSourceEventInTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        sourceFamily: "widget",
        status: "processed",
        transactionId: "txn-widget-cap-test",
      })
    );
  });

  it("continues processing after one entry fails", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "good-1", amount: 1000, createdAt: "2026-03-27T10:00:00Z" },
      { id: "bad-1", amount: 2000, createdAt: "2026-03-27T10:00:00Z" },
      { id: "good-2", amount: 3000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    let callCount = 0;
    mockIsCaptureProcessed.mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error("DB error");
      return false;
    });

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(result.saved).toBe(2);
    expect(result.errors).toBe(1);
    expect(mockRemovePendingTransactions).toHaveBeenCalledWith(["good-1", "good-2"]);
  });

  it("continues processing when failed source-event persistence also fails", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "bad-audit", amount: 1000, createdAt: "2026-03-27T10:00:00Z" },
      { id: "good-after-audit", amount: 2000, createdAt: "2026-03-27T10:00:00Z" },
    ]);
    mockIsCaptureProcessed
      .mockRejectedValueOnce(new Error("dedup failed"))
      .mockResolvedValueOnce(false);
    mockPersistProcessedSourceEvent.mockImplementationOnce(() => {
      throw new Error("failed audit write");
    });

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(result).toEqual({ saved: 1, skippedDuplicate: 0, errors: 1 });
    expect(mockRemovePendingTransactions).toHaveBeenCalledWith(["good-after-audit"]);
  });

  it("records Local Ledger rejection reason when widget recording fails", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "bad-ledger", amount: 1000, createdAt: "2026-03-27T10:00:00Z" },
    ]);
    mockRecordAutomatedTransactionWithLocalLedger.mockResolvedValueOnce({
      success: false,
      error: "category-not-usable",
    });

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(result.errors).toBe(1);
    expect(mockPersistProcessedSourceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureReason: "local_ledger_rejected:category-not-usable",
      })
    );
    expect(mockRemovePendingTransactions).not.toHaveBeenCalled();
  });

  it("does not remove entries that failed processing", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "fail-entry", amount: 1000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    mockIsCaptureProcessed.mockRejectedValue(new Error("DB error"));

    const result = await processWidgetTransactions(mockDb, USER_ID);

    expect(result.errors).toBe(1);
    expect(mockRemovePendingTransactions).not.toHaveBeenCalled();
  });
});
