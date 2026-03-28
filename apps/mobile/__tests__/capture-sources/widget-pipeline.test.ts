// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();
const mockGetPendingTransactions = vi.fn();
const mockRemovePendingTransactions = vi.fn();
const mockIsAvailable = vi.fn();

vi.mock("@/features/transactions/lib/repository", () => ({
  upsertTransaction: (...args: any[]) => mockUpsertTransaction(...args),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: (...args: any[]) => mockEnqueueSync(...args),
}));

vi.mock("@/modules/expo-app-intents", () => ({
  getPendingTransactions: (...args: any[]) => mockGetPendingTransactions(...args),
  removePendingTransactions: (...args: any[]) => mockRemovePendingTransactions(...args),
  isAvailable: () => mockIsAvailable(),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: any[]) => mockGenerateId(...args),
  generateSyncQueueId: () => mockGenerateId("sq"),
}));

import { processWidgetTransactions } from "@/features/capture-sources/services/widget-pipeline";
import type { UserId } from "@/shared/types/branded";

const mockDb = {} as any;
const USER_ID = "user-1" as UserId;

describe("processWidgetTransactions", () => {
  let idCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockGenerateId.mockImplementation((prefix: string) => {
      idCounter++;
      return `${prefix}-${idCounter}`;
    });
    mockIsAvailable.mockReturnValue(true);
    mockGetPendingTransactions.mockResolvedValue([]);
    mockRemovePendingTransactions.mockResolvedValue(undefined);
  });

  it("early-returns when isAvailable() is false", async () => {
    mockIsAvailable.mockReturnValue(false);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockGetPendingTransactions).not.toHaveBeenCalled();
    expect(mockUpsertTransaction).not.toHaveBeenCalled();
  });

  it("early-returns when pending list is empty", async () => {
    mockGetPendingTransactions.mockResolvedValue([]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).not.toHaveBeenCalled();
    expect(mockRemovePendingTransactions).not.toHaveBeenCalled();
  });

  it("saves a single pending transaction with widget source", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "abc-123", amount: 25000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).toHaveBeenCalledOnce();
    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        id: "txn-widget-abc-123",
        userId: USER_ID,
        type: "expense",
        amount: 25000,
        categoryId: "other",
        description: "",
        source: "widget",
      })
    );
  });

  it("derives deterministic transaction ID from widget entry ID", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "stable-uuid", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ id: "txn-widget-stable-uuid" })
    );
  });

  it("enqueues sync for each saved transaction", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "sync-1", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockEnqueueSync).toHaveBeenCalledOnce();
    expect(mockEnqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        rowId: "txn-widget-sync-1",
        operation: "insert",
      })
    );
  });

  it("removes only processed pending entries after success", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "id-a", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
      { id: "id-b", amount: 20000, createdAt: "2026-03-27T11:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).toHaveBeenCalledTimes(2);
    expect(mockEnqueueSync).toHaveBeenCalledTimes(2);
    expect(mockRemovePendingTransactions).toHaveBeenCalledOnce();
    expect(mockRemovePendingTransactions).toHaveBeenCalledWith(["id-a", "id-b"]);
  });

  it("processes multiple pending transactions with unique IDs", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "uuid-1", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
      { id: "uuid-2", amount: 20000, createdAt: "2026-03-27T11:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    const firstTxCall = mockUpsertTransaction.mock.calls[0][1];
    const secondTxCall = mockUpsertTransaction.mock.calls[1][1];
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

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
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

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ amount: 15001 })
    );
  });

  it("uses category from pending item when valid", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "cat-test", amount: 8000, createdAt: "2026-03-27T10:00:00Z", category: "food" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "food" })
    );
  });

  it("falls back to 'other' when category is invalid", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "bad-cat", amount: 5000, createdAt: "2026-03-27T10:00:00Z", category: "invalid" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "other" })
    );
  });

  it("uses type=income when specified", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "income-test", amount: 50000, createdAt: "2026-03-27T10:00:00Z", type: "income" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
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

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ description: "Coffee at Juan Valdez" })
    );
  });

  it("defaults optional fields when absent (backward compatible)", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { id: "compat-test", amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        type: "expense",
        categoryId: "other",
        description: "",
      })
    );
  });
});
