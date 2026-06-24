import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransactionMutationService } from "@/features/transactions/lib/mutation-service";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const now = new Date("2026-04-12T10:00:00.000Z");

const input = {
  type: "expense" as const,
  digits: "1200",
  categoryId: "food" as CategoryId,
  accountId: "fa-default-user-1" as FinancialAccountId,
  description: "Lunch",
  date: new Date("2026-04-12T00:00:00.000Z"),
};

describe("transaction mutation service", () => {
  type ServiceDeps = Parameters<typeof createTransactionMutationService>[0];

  let currentUserId: UserId | null;
  let refresh: ServiceDeps["refresh"];
  let resetForm: ServiceDeps["resetForm"];
  let trackDeleted: ServiceDeps["trackDeleted"];
  let trackEdited: ServiceDeps["trackEdited"];
  let cacheCommittedTransaction: NonNullable<ServiceDeps["cacheCommittedTransaction"]>;
  let recordManualTransaction: ServiceDeps["recordManualTransaction"];
  let amendManualTransaction: ServiceDeps["amendManualTransaction"];
  let voidTransaction: ServiceDeps["voidTransaction"];
  let refreshMock: ReturnType<typeof vi.fn>;
  let resetFormMock: ReturnType<typeof vi.fn>;
  let trackDeletedMock: ReturnType<typeof vi.fn>;
  let trackEditedMock: ReturnType<typeof vi.fn>;
  let cacheCommittedTransactionMock: ReturnType<typeof vi.fn>;
  let recordManualTransactionMock: ReturnType<typeof vi.fn>;
  let amendManualTransactionMock: ReturnType<typeof vi.fn>;
  let voidTransactionMock: ReturnType<typeof vi.fn>;

  function createService() {
    return createTransactionMutationService({
      getUserId: () => currentUserId,
      refresh,
      resetForm,
      trackDeleted,
      trackEdited,
      cacheCommittedTransaction,
      recordManualTransaction,
      amendManualTransaction,
      voidTransaction,
      now: () => now,
      createId: () => "txn-1" as TransactionId,
    });
  }

  beforeEach(() => {
    currentUserId = "user-1" as UserId;
    refreshMock = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
    resetFormMock = vi.fn<(...args: any[]) => any>();
    trackDeletedMock = vi.fn<(...args: any[]) => any>();
    trackEditedMock = vi.fn<(...args: any[]) => any>();
    cacheCommittedTransactionMock = vi.fn<(...args: any[]) => any>();
    recordManualTransactionMock = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: true,
      transaction: {
        id: "txn-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 1200 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Lunch",
        counterpartyName: "",
        date: now,
        createdAt: now,
        updatedAt: now,
        voidedAt: null,
        accountId: "fa-default-user-1" as FinancialAccountId,
        accountAttributionState: "confirmed",
        supersededAt: null,
        supersededByTransferId: null,
        source: "manual",
      },
    });
    amendManualTransactionMock = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: true,
      transaction: {
        id: "txn-9" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 1200 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Lunch",
        counterpartyName: "",
        date: now,
        createdAt: now,
        updatedAt: now,
        voidedAt: null,
        accountId: "fa-default-user-1" as FinancialAccountId,
        accountAttributionState: "confirmed",
        supersededAt: null,
        supersededByTransferId: null,
        source: "manual",
      },
    });
    voidTransactionMock = vi.fn<(...args: any[]) => any>().mockResolvedValue({ success: true });
    refresh = refreshMock as ServiceDeps["refresh"];
    resetForm = resetFormMock as ServiceDeps["resetForm"];
    trackDeleted = trackDeletedMock as ServiceDeps["trackDeleted"];
    trackEdited = trackEditedMock as ServiceDeps["trackEdited"];
    cacheCommittedTransaction = cacheCommittedTransactionMock as NonNullable<
      ServiceDeps["cacheCommittedTransaction"]
    >;
    recordManualTransaction = recordManualTransactionMock as ServiceDeps["recordManualTransaction"];
    amendManualTransaction = amendManualTransactionMock as ServiceDeps["amendManualTransaction"];
    voidTransaction = voidTransactionMock as ServiceDeps["voidTransaction"];
  });

  it("returns store-not-initialized when the user is unavailable", async () => {
    currentUserId = null;
    const service = createService();

    await expect(service.save(input)).resolves.toEqual({
      success: false,
      error: "Store not initialized",
    });
  });

  it("returns Local Ledger validation failures directly", async () => {
    recordManualTransactionMock.mockResolvedValueOnce({
      success: false,
      error: "amountNotPositive",
    });
    const service = createService();
    const result = await service.save({ ...input, digits: "" });

    expect(result).toEqual({ success: false, error: "amountNotPositive" });
  });

  it("maps failed manual Local Ledger writes to a save error", async () => {
    recordManualTransactionMock.mockResolvedValueOnce({
      success: false,
      error: "accountNotUsable",
    });
    const service = createService();

    await expect(service.save(input)).resolves.toEqual({
      success: false,
      error: "accountNotUsable",
    });
  });

  it("maps manual Local Ledger writer exceptions to a save error", async () => {
    recordManualTransactionMock.mockRejectedValueOnce(new Error("sqlite locked"));
    const service = createService();

    await expect(service.save(input)).resolves.toEqual({
      success: false,
      error: "Failed to save transaction",
    });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(cacheCommittedTransactionMock).not.toHaveBeenCalled();
  });

  it("saves valid transactions, caches them, then refreshes read models", async () => {
    const service = createService();

    const result = await service.save(input);

    expect(result).toMatchObject({
      success: true,
      transaction: expect.objectContaining({
        id: "txn-1",
        userId: "user-1",
        amount: 1200,
        categoryId: "food",
        accountId: "fa-default-user-1",
      }),
    });
    expect(recordManualTransactionMock).toHaveBeenCalledWith({
      userId: "user-1",
      transactionId: "txn-1",
      input,
      now,
    });
    expect(cacheCommittedTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "txn-1", amount: 1200 }),
      { countInPagination: true }
    );
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(cacheCommittedTransactionMock.mock.invocationCallOrder[0]).toBeLessThan(
      refreshMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it("treats throwing amend writers as update failures", async () => {
    amendManualTransactionMock.mockRejectedValueOnce(new Error("boom"));
    const service = createService();

    await expect(service.updateDirect("txn-9" as TransactionId, input)).resolves.toEqual({
      success: false,
      error: "Failed to update transaction",
    });
  });

  it("updates transactions directly without resetting the form", async () => {
    const service = createService();

    const result = await service.updateDirect("txn-9" as TransactionId, input);

    expect(result).toMatchObject({
      success: true,
      transaction: expect.objectContaining({ id: "txn-9" }),
    });
    expect(trackEditedMock).toHaveBeenCalledWith({ category: "food" });
    expect(resetFormMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("delegates captured transaction metadata preservation to Local Ledger amend writer", async () => {
    const service = createService();

    await service.updateDirect("txn-9" as TransactionId, {
      ...input,
      accountId: "fa-card-1" as FinancialAccountId,
    });

    expect(amendManualTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "txn-9",
        input: expect.objectContaining({ accountId: "fa-card-1" }),
      })
    );
  });

  it("returns an update error without side effects when the Local Ledger amend fails", async () => {
    amendManualTransactionMock.mockResolvedValueOnce({
      success: false,
      error: "update failed",
    });
    const service = createService();

    await expect(service.updateDirect("txn-9" as TransactionId, input)).resolves.toEqual({
      success: false,
      error: "update failed",
    });

    expect(trackEditedMock).not.toHaveBeenCalled();
    expect(resetFormMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("returns validation failures from updateDirect without side effects", async () => {
    amendManualTransactionMock.mockResolvedValueOnce({
      success: false,
      error: "amountNotPositive",
    });
    const service = createService();

    const result = await service.updateDirect("txn-9" as TransactionId, { ...input, digits: "" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toEqual(expect.any(String));
    expect(trackEditedMock).not.toHaveBeenCalled();
    expect(resetFormMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("throws on failed deletes and still refreshes when user is unavailable", async () => {
    voidTransactionMock.mockResolvedValueOnce({
      success: false,
      error: "delete failed",
    });
    const service = createService();

    await expect(service.remove("txn-2" as TransactionId)).rejects.toThrow("delete failed");
    expect(trackDeletedMock).not.toHaveBeenCalled();

    currentUserId = null;
    await service.remove("txn-3" as TransactionId);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("tracks successful deletes and refreshes afterward", async () => {
    const service = createService();

    await service.remove("txn-4" as TransactionId);

    expect(voidTransactionMock).toHaveBeenCalledWith({
      userId: "user-1",
      transactionId: "txn-4",
      now,
    });
    expect(trackDeletedMock).toHaveBeenCalledOnce();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("returns a validation failure when no owning account is selected", async () => {
    recordManualTransactionMock.mockResolvedValueOnce({
      success: false,
      error: "missingAccount",
    });
    const service = createService();

    await expect(service.save({ ...input, accountId: null })).resolves.toEqual({
      success: false,
      error: "missingAccount",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
