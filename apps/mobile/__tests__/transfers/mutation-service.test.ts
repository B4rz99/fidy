import { beforeEach, describe, expect, it, vi } from "vitest";
import { OUTSIDE_FIDY_LABEL } from "@/features/transfers/lib/build-transfer";
import { createTransferMutationService } from "@/features/transfers/lib/mutation-service";
import type { AnyDb } from "@/shared/db";
import type { FinancialAccountId, TransferId, UserId } from "@/shared/types/branded";

const now = new Date("2026-04-19T10:00:00.000Z");

const validInput = {
  digits: "450000",
  fromSide: { kind: "account" as const, accountId: "fa-checking" as FinancialAccountId },
  toSide: { kind: "external" as const, label: OUTSIDE_FIDY_LABEL },
  description: "Visa payment",
  date: new Date("2026-04-19T00:00:00.000Z"),
};

describe("transfer mutation service", () => {
  type ServiceDeps = Parameters<typeof createTransferMutationService>[0];

  let currentUserId: UserId | null;
  let currentDb: AnyDb | null;
  let refresh: ServiceDeps["refresh"];
  let recordTransfer: ServiceDeps["recordTransfer"];
  let refreshMock: ReturnType<typeof vi.fn>;
  let recordTransferMock: ReturnType<typeof vi.fn>;

  function createService() {
    return createTransferMutationService({
      getUserId: () => currentUserId,
      getDb: () => currentDb,
      refresh,
      recordTransfer,
      now: () => now,
      createId: () => "tr-new" as TransferId,
    });
  }

  beforeEach(() => {
    currentUserId = "user-1" as UserId;
    currentDb = {} as AnyDb;
    refreshMock = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
    recordTransferMock = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: true,
      transfer: {
        id: "tr-new" as TransferId,
        userId: "user-1" as UserId,
        amount: 450000,
        fromSide: validInput.fromSide,
        toSide: validInput.toSide,
        description: "Visa payment",
        date: "2026-04-19",
        createdAt: "2026-04-19T10:00:00.000Z",
        updatedAt: "2026-04-19T10:00:00.000Z",
        voidedAt: null,
      },
    });
    refresh = refreshMock as ServiceDeps["refresh"];
    recordTransfer = recordTransferMock as ServiceDeps["recordTransfer"];
  });

  it("returns store-not-initialized when the user is unavailable", async () => {
    currentUserId = null;
    const service = createService();

    await expect(service.save(validInput)).resolves.toEqual({
      success: false,
      error: "storeNotInitialized",
    });
  });

  it("delegates invalid transfer commands to the Local Ledger writer", async () => {
    recordTransferMock.mockResolvedValueOnce({
      success: false,
      error: "distinctSidesRequired",
    });
    const service = createService();

    await expect(
      service.save({
        ...validInput,
        toSide: {
          kind: "account",
          accountId: "fa-checking" as FinancialAccountId,
        },
      })
    ).resolves.toEqual({
      success: false,
      error: "distinctSidesRequired",
    });
    expect(recordTransferMock).toHaveBeenCalledOnce();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("records a valid transfer through the Local Ledger writer and refreshes the caller boundary", async () => {
    const service = createService();

    const result = await service.save(validInput);

    expect(result).toMatchObject({
      success: true,
      transfer: expect.objectContaining({
        id: "tr-new" as TransferId,
        userId: "user-1" as UserId,
        amount: 450000 as never,
      }),
    });
    expect(recordTransferMock).toHaveBeenCalledWith({
      db: currentDb,
      userId: "user-1" as UserId,
      transferId: "tr-new" as TransferId,
      input: validInput,
      now,
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("maps Local Ledger voided transfer state into the existing transfer read model", async () => {
    recordTransferMock.mockResolvedValueOnce({
      success: true,
      transfer: {
        id: "tr-new" as TransferId,
        userId: "user-1" as UserId,
        amount: 450000,
        fromSide: validInput.fromSide,
        toSide: validInput.toSide,
        description: "Visa payment",
        date: "2026-04-19",
        createdAt: "2026-04-19T10:00:00.000Z",
        updatedAt: "2026-04-19T10:00:00.000Z",
        voidedAt: "2026-04-20T08:00:00.000Z",
      },
    });
    const service = createService();

    const result = await service.save(validInput);

    expect(result).toEqual({
      success: true,
      transfer: expect.objectContaining({
        deletedAt: new Date("2026-04-20T08:00:00.000Z"),
      }),
    });
    expect(result.success ? result.transfer : null).not.toHaveProperty("voidedAt");
  });

  it("returns Local Ledger validation failures without refreshing", async () => {
    recordTransferMock.mockResolvedValueOnce({
      success: false,
      error: "accountNotUsable",
    });
    const service = createService();

    await expect(service.save(validInput)).resolves.toEqual({
      success: false,
      error: "accountNotUsable",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("maps thrown persistence failures to a save error", async () => {
    recordTransferMock.mockImplementation(() => {
      throw new Error("db failed");
    });
    const service = createService();

    await expect(service.save(validInput)).resolves.toEqual({
      success: false,
      error: "saveFailed",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("treats refresh failures as a successful persisted save", async () => {
    refreshMock.mockRejectedValueOnce(new Error("refresh failed"));
    const service = createService();

    const result = await service.save(validInput);

    expect(result).toMatchObject({
      success: true,
      transfer: expect.objectContaining({
        id: "tr-new" as TransferId,
      }),
    });
    expect(recordTransferMock).toHaveBeenCalledOnce();
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
