import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyDb } from "@/shared/db";
import { getMutationPolicy } from "@/shared/mutations";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: vi.fn(),
}));

vi.mock("@/shared/lib", () => ({
  generateBudgetId: vi.fn().mockReturnValue("budget-generated"),
  generateSyncQueueId: vi.fn().mockReturnValue("sync-generated"),
}));

const mockDb = {
  transaction: vi.fn((fn: (tx: AnyDb) => unknown) => fn(mockDb as AnyDb)),
} as unknown as AnyDb;

async function loadGenericModule() {
  return import("@/shared/mutations");
}

describe("write-through mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes the explicit sync policy", () => {
    expect(getMutationPolicy("calendar.bill.save")).toBe("local-only");
    expect(getMutationPolicy("transaction.save")).toBe("sync-backed");
  });

  it("commits commands through the injected generic applier", async () => {
    const { createGenericWriteThroughMutationModule } = await loadGenericModule();
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;
    const applyCommand = vi.fn(() => ({ didMutate: true, effects: [] }));
    const module = createGenericWriteThroughMutationModule(mockDb, applyCommand);

    const command = {
      kind: "transaction.save" as const,
      mode: "insert" as const,
      row: {
        id: "tx-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense" as const,
        amount: 1000 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Lunch",
        date: "2026-04-12" as IsoDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    };

    const result = await module.commit(command);

    expect(result).toEqual({ success: true, didMutate: true });
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(applyCommand).toHaveBeenCalledWith(mockDb, command);
  });

  it("runs collected after-commit effects after a generic batch succeeds", async () => {
    const { createGenericWriteThroughMutationModule } = await loadGenericModule();
    const effectOne = vi.fn();
    const effectTwo = vi.fn();
    const applyCommand = vi
      .fn()
      .mockReturnValueOnce({ didMutate: true, effects: [effectOne] })
      .mockReturnValueOnce({ didMutate: false, effects: [effectTwo] });
    const module = createGenericWriteThroughMutationModule(mockDb, applyCommand);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    const result = await module.commitBatch([
      {
        kind: "transaction.save",
        mode: "insert",
        row: {
          id: "tx-batch-1" as TransactionId,
          userId: "user-1" as UserId,
          type: "expense",
          amount: 1000 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "Lunch",
          date: "2026-04-12" as IsoDate,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      },
      {
        kind: "transaction.save",
        mode: "update",
        row: {
          id: "tx-batch-2" as TransactionId,
          userId: "user-1" as UserId,
          type: "expense",
          amount: 2000 as CopAmount,
          categoryId: "transport" as CategoryId,
          description: "Bus",
          date: "2026-04-12" as IsoDate,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      },
    ]);

    expect(result).toEqual([
      { success: true, didMutate: true },
      { success: true, didMutate: false },
    ]);
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(applyCommand).toHaveBeenCalledTimes(2);
    expect(effectOne).toHaveBeenCalledOnce();
    expect(effectTwo).toHaveBeenCalledOnce();
  });

  it("delegates command application to an injected applier", async () => {
    const { createGenericWriteThroughMutationModule } = await loadGenericModule();
    const applyCommand = vi.fn(() => ({ didMutate: true, effects: [] }));
    const module = createGenericWriteThroughMutationModule(mockDb, applyCommand);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    await module.commit({
      kind: "transaction.save",
      mode: "insert",
      row: {
        id: "tx-generic-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 1000 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Lunch",
        date: "2026-04-12" as IsoDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    });

    expect(applyCommand).toHaveBeenCalledOnce();
  });
});
