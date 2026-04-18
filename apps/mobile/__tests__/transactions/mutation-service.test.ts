import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransactionMutationService } from "@/features/transactions/lib/mutation-service";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import type { CategoryId, TransactionId, UserId } from "@/shared/types/branded";

const now = new Date("2026-04-12T10:00:00.000Z");

const input = {
  type: "expense" as const,
  digits: "1200",
  categoryId: "food" as CategoryId,
  description: "Lunch",
  date: new Date("2026-04-12T00:00:00.000Z"),
};

describe("transaction mutation service", () => {
  type ServiceDeps = Parameters<typeof createTransactionMutationService>[0];

  let currentCommit: WriteThroughMutationModule["commit"] | null;
  let currentUserId: UserId | null;
  let refresh: ServiceDeps["refresh"];
  let resetForm: ServiceDeps["resetForm"];
  let trackDeleted: ServiceDeps["trackDeleted"];
  let trackEdited: ServiceDeps["trackEdited"];
  let refreshMock: ReturnType<typeof vi.fn>;
  let resetFormMock: ReturnType<typeof vi.fn>;
  let trackDeletedMock: ReturnType<typeof vi.fn>;
  let trackEditedMock: ReturnType<typeof vi.fn>;

  function createService() {
    return createTransactionMutationService({
      getCommit: () => currentCommit,
      getUserId: () => currentUserId,
      refresh,
      resetForm,
      trackDeleted,
      trackEdited,
      now: () => now,
      createId: () => "txn-1" as TransactionId,
    });
  }

  beforeEach(() => {
    currentUserId = "user-1" as UserId;
    currentCommit = vi.fn();
    refreshMock = vi.fn().mockResolvedValue(undefined);
    resetFormMock = vi.fn();
    trackDeletedMock = vi.fn();
    trackEditedMock = vi.fn();
    refresh = refreshMock as ServiceDeps["refresh"];
    resetForm = resetFormMock as ServiceDeps["resetForm"];
    trackDeleted = trackDeletedMock as ServiceDeps["trackDeleted"];
    trackEdited = trackEditedMock as ServiceDeps["trackEdited"];
  });

  it("returns store-not-initialized when the user is unavailable", async () => {
    currentUserId = null;
    const service = createService();

    await expect(service.save(input)).resolves.toEqual({
      success: false,
      error: "Store not initialized",
    });
  });

  it("returns build validation failures directly", async () => {
    const service = createService();
    const result = await service.save({
      ...input,
      digits: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toEqual(expect.any(String));
  });

  it("maps failed insert commits to a save error", async () => {
    currentCommit = vi.fn().mockResolvedValue({
      success: false,
      error: "db failed",
    });
    const service = createService();

    await expect(service.save(input)).resolves.toEqual({
      success: false,
      error: "Failed to save transaction",
    });
  });

  it("saves valid transactions through the write-through boundary", async () => {
    currentCommit = vi.fn().mockResolvedValue({ success: true, didMutate: true });
    const service = createService();

    const result = await service.save(input);

    expect(result).toMatchObject({
      success: true,
      transaction: expect.objectContaining({
        id: "txn-1",
        userId: "user-1",
        amount: 1200,
        categoryId: "food",
      }),
    });
    expect(currentCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "transaction.save",
        mode: "insert",
      })
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("treats missing or throwing commits as save/update failures", async () => {
    currentCommit = null;
    const service = createService();

    await expect(service.save(input)).resolves.toEqual({
      success: false,
      error: "Store not initialized",
    });

    currentCommit = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(service.updateDirect("txn-9" as TransactionId, input)).resolves.toEqual({
      success: false,
      error: "Failed to update transaction",
    });
  });

  it("updates transactions and resets the form on success", async () => {
    currentCommit = vi.fn().mockResolvedValue({ success: true, didMutate: true });
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
    currentCommit = vi.fn().mockResolvedValue({
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
    currentCommit = vi.fn().mockResolvedValue({ success: true, didMutate: true });
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

  it("returns an update error without side effects when the write-through update fails", async () => {
    currentCommit = vi.fn().mockResolvedValue({
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
    const failingCommit = vi.fn().mockResolvedValue({
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
    currentCommit = vi.fn().mockResolvedValue({ success: true, didMutate: true });
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
});
