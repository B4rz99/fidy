// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();
const mockGetPendingTransactions = vi.fn();
const mockClearPendingTransactions = vi.fn();
const mockIsAvailable = vi.fn();

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: any[]) => mockInsertTransaction(...args),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: (...args: any[]) => mockEnqueueSync(...args),
}));

vi.mock("@/modules/expo-app-intents", () => ({
  getPendingTransactions: (...args: any[]) => mockGetPendingTransactions(...args),
  clearPendingTransactions: (...args: any[]) => mockClearPendingTransactions(...args),
  isAvailable: () => mockIsAvailable(),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: any[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
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
    mockClearPendingTransactions.mockResolvedValue(undefined);
  });

  it("early-returns when isAvailable() is false", async () => {
    mockIsAvailable.mockReturnValue(false);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockGetPendingTransactions).not.toHaveBeenCalled();
    expect(mockInsertTransaction).not.toHaveBeenCalled();
  });

  it("early-returns when pending list is empty", async () => {
    mockGetPendingTransactions.mockResolvedValue([]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockClearPendingTransactions).not.toHaveBeenCalled();
  });

  it("saves a single pending transaction with widget source", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { amount: 25000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledOnce();
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        id: "tx-1",
        userId: USER_ID,
        type: "expense",
        amount: 25000,
        categoryId: "other",
        description: "",
        source: "widget",
      })
    );
  });

  it("enqueues sync for each saved transaction", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockEnqueueSync).toHaveBeenCalledOnce();
    expect(mockEnqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        rowId: "tx-1",
        operation: "insert",
      })
    );
  });

  it("clears pending transactions after all are processed", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
      { amount: 20000, createdAt: "2026-03-27T11:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledTimes(2);
    expect(mockEnqueueSync).toHaveBeenCalledTimes(2);
    expect(mockClearPendingTransactions).toHaveBeenCalledOnce();
  });

  it("processes multiple pending transactions with unique IDs", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { amount: 10000, createdAt: "2026-03-27T10:00:00Z" },
      { amount: 20000, createdAt: "2026-03-27T11:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    const firstTxCall = mockInsertTransaction.mock.calls[0][1];
    const secondTxCall = mockInsertTransaction.mock.calls[1][1];
    expect(firstTxCall.id).toBe("tx-1");
    expect(secondTxCall.id).toBe("tx-2");
    expect(firstTxCall.amount).toBe(10000);
    expect(secondTxCall.amount).toBe(20000);
  });

  it("uses toIsoDate from item.createdAt for the transaction date", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { amount: 5000, createdAt: "2026-03-15T14:30:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
  });

  it("rounds fractional amounts to nearest integer", async () => {
    mockGetPendingTransactions.mockResolvedValue([
      { amount: 15000.7, createdAt: "2026-03-27T10:00:00Z" },
    ]);

    await processWidgetTransactions(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ amount: 15001 })
    );
  });
});
