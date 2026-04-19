import { beforeEach, describe, expect, it, vi } from "vitest";
import { OUTSIDE_FIDY_LABEL } from "@/features/transfers/lib/build-transfer";
import { createTransferMutationService } from "@/features/transfers/lib/mutation-service";
import type { TransferRow } from "@/features/transfers/lib/repository";
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
  let saveTransferRow: ServiceDeps["saveTransferRow"];
  let refreshMock: ReturnType<typeof vi.fn>;
  let saveTransferRowMock: ReturnType<typeof vi.fn>;

  function createService() {
    return createTransferMutationService({
      getUserId: () => currentUserId,
      getDb: () => currentDb,
      refresh,
      saveTransferRow,
      now: () => now,
      createId: () => "tr-new" as TransferId,
    });
  }

  beforeEach(() => {
    currentUserId = "user-1" as UserId;
    currentDb = {} as AnyDb;
    refreshMock = vi.fn().mockResolvedValue(undefined);
    saveTransferRowMock = vi.fn();
    refresh = refreshMock as ServiceDeps["refresh"];
    saveTransferRow = saveTransferRowMock as ServiceDeps["saveTransferRow"];
  });

  it("returns store-not-initialized when the user is unavailable", async () => {
    currentUserId = null;
    const service = createService();

    await expect(service.save(validInput)).resolves.toEqual({
      success: false,
      error: "storeNotInitialized",
    });
  });

  it("returns transfer validation failures directly", async () => {
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
  });

  it("saves a valid transfer row and refreshes the caller boundary", async () => {
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
    expect(saveTransferRowMock).toHaveBeenCalledWith(
      currentDb,
      expect.objectContaining<Partial<TransferRow>>({
        id: "tr-new" as TransferId,
        amount: 450000 as never,
        fromAccountId: "fa-checking" as FinancialAccountId,
        toExternalLabel: OUTSIDE_FIDY_LABEL,
      })
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("maps thrown persistence failures to a save error", async () => {
    saveTransferRowMock.mockImplementation(() => {
      throw new Error("db failed");
    });
    const service = createService();

    await expect(service.save(validInput)).resolves.toEqual({
      success: false,
      error: "saveFailed",
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
