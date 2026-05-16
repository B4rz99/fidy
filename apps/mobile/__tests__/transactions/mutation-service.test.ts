import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransactionMutationService } from "@/features/transactions/lib/mutation-service";
import type { StoredTransaction } from "@/features/transactions/schema";
import type { WriteThroughMutationModule } from "@/shared/mutations";
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

function makeCapturedStoredTransaction(
  overrides: Partial<StoredTransaction> = {}
): StoredTransaction {
  return {
    id: "txn-9" as TransactionId,
    userId: "user-1" as UserId,
    type: "expense",
    amount: 9800 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Original capture",
    counterpartyName: "",
    date: new Date("2026-04-10T00:00:00.000Z"),
    createdAt: new Date("2026-04-10T10:00:00.000Z"),
    updatedAt: new Date("2026-04-10T10:00:00.000Z"),
    voidedAt: null,
    accountId: "fa-card-1" as FinancialAccountId,
    accountAttributionState: "unresolved",
    supersededAt: new Date("2026-04-11T10:00:00.000Z"),
    source: "email_capture",
    ...overrides,
  };
}

describe("transaction mutation service", () => {
  type ServiceDeps = Parameters<typeof createTransactionMutationService>[0];

  let currentCommit: WriteThroughMutationModule["commit"] | null;
  let currentUserId: UserId | null;
  let refresh: ServiceDeps["refresh"];
  let resetForm: ServiceDeps["resetForm"];
  let trackDeleted: ServiceDeps["trackDeleted"];
  let trackEdited: ServiceDeps["trackEdited"];
  let getTransactionById: ServiceDeps["getTransactionById"];
  let recordManualTransaction: ServiceDeps["recordManualTransaction"];
  let refreshMock: ReturnType<typeof vi.fn>;
  let resetFormMock: ReturnType<typeof vi.fn>;
  let trackDeletedMock: ReturnType<typeof vi.fn>;
  let trackEditedMock: ReturnType<typeof vi.fn>;
  let getTransactionByIdMock: ReturnType<typeof vi.fn>;
  let recordManualTransactionMock: ReturnType<typeof vi.fn>;

  function createService() {
    return createTransactionMutationService({
      getCommit: () => currentCommit,
      getUserId: () => currentUserId,
      refresh,
      resetForm,
      trackDeleted,
      trackEdited,
      getTransactionById,
      recordManualTransaction,
      now: () => now,
      createId: () => "txn-1" as TransactionId,
    });
  }

  beforeEach(() => {
    currentUserId = "user-1" as UserId;
    currentCommit = vi.fn<(...args: any[]) => any>();
    refreshMock = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
    resetFormMock = vi.fn<(...args: any[]) => any>();
    trackDeletedMock = vi.fn<(...args: any[]) => any>();
    trackEditedMock = vi.fn<(...args: any[]) => any>();
    getTransactionByIdMock = vi.fn<(...args: any[]) => any>().mockReturnValue(null);
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
    refresh = refreshMock as ServiceDeps["refresh"];
    resetForm = resetFormMock as ServiceDeps["resetForm"];
    trackDeleted = trackDeletedMock as ServiceDeps["trackDeleted"];
    trackEdited = trackEditedMock as ServiceDeps["trackEdited"];
    getTransactionById = getTransactionByIdMock as ServiceDeps["getTransactionById"];
    recordManualTransaction = recordManualTransactionMock as ServiceDeps["recordManualTransaction"];
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
  });

  it("saves valid transactions through the Local Ledger writer", async () => {
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
    expect(currentCommit).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("treats throwing update commits as update failures", async () => {
    currentCommit = null;
    const service = createService();

    currentCommit = vi.fn<(...args: any[]) => any>().mockRejectedValue(new Error("boom"));
    await expect(service.updateDirect("txn-9" as TransactionId, input)).resolves.toEqual({
      success: false,
      error: "Failed to update transaction",
    });
  });

  it("updates transactions and resets the form on success", async () => {
    currentCommit = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue({ success: true, didMutate: true });
    const service = createService();

    const result = await service.update("txn-9" as TransactionId, input);

    expect(result).toMatchObject({
      success: true,
      transaction: expect.objectContaining({ id: "txn-9" }),
    });
    expect(trackEditedMock).toHaveBeenCalledWith({ category: "food" });
    expect(resetFormMock).toHaveBeenCalledOnce();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("returns a failed update result when the commit reports no mutation", async () => {
    currentCommit = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: false,
      error: "write-through rejected update",
    });
    const service = createService();

    await expect(service.update("txn-9" as TransactionId, input)).resolves.toEqual({
      success: false,
      error: "Failed to update transaction",
    });
    expect(trackEditedMock).not.toHaveBeenCalled();
    expect(resetFormMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("updates transactions directly without resetting the form", async () => {
    currentCommit = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue({ success: true, didMutate: true });
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

  it("preserves ownership metadata when updating a captured transaction", async () => {
    currentCommit = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue({ success: true, didMutate: true });
    getTransactionByIdMock.mockReturnValue(makeCapturedStoredTransaction());
    const service = createService();

    await service.updateDirect("txn-9" as TransactionId, {
      ...input,
      accountId: "fa-card-1" as FinancialAccountId,
    });

    expect(currentCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "transaction.save",
        mode: "update",
        row: expect.objectContaining({
          id: "txn-9",
          accountId: "fa-card-1",
          accountAttributionState: "unresolved",
          supersededAt: "2026-04-11T10:00:00.000Z",
          source: "email_capture",
          createdAt: "2026-04-10T10:00:00.000Z",
          updatedAt: "2026-04-12T10:00:00.000Z",
        }),
      })
    );
  });

  it("returns an update error without side effects when the write-through update fails", async () => {
    currentCommit = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: false,
      error: "update failed",
    });
    const service = createService();

    await expect(service.update("txn-9" as TransactionId, input)).resolves.toEqual({
      success: false,
      error: "Failed to update transaction",
    });

    expect(trackEditedMock).not.toHaveBeenCalled();
    expect(resetFormMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "update",
      (service: ReturnType<typeof createService>) =>
        service.update("txn-9" as TransactionId, { ...input, digits: "" }),
    ],
    [
      "updateDirect",
      (service: ReturnType<typeof createService>) =>
        service.updateDirect("txn-9" as TransactionId, { ...input, digits: "" }),
    ],
  ])("returns validation failures from %s without side effects", async (_method, runMutation) => {
    const service = createService();

    const result = await runMutation(service);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toEqual(expect.any(String));
    expect(currentCommit).not.toHaveBeenCalled();
    expect(trackEditedMock).not.toHaveBeenCalled();
    expect(resetFormMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("throws on failed deletes and still refreshes when commits are unavailable", async () => {
    const failingCommit = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: false,
      error: "delete failed",
    });
    currentCommit = failingCommit;
    const service = createService();

    await expect(service.remove("txn-2" as TransactionId)).rejects.toThrow("delete failed");
    expect(trackDeletedMock).not.toHaveBeenCalled();

    currentCommit = null;
    await service.remove("txn-3" as TransactionId);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("tracks successful deletes and refreshes afterward", async () => {
    currentCommit = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue({ success: true, didMutate: true });
    const service = createService();

    await service.remove("txn-4" as TransactionId);

    expect(currentCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "transaction.delete",
        transactionId: "txn-4",
      })
    );
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
    expect(currentCommit).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
