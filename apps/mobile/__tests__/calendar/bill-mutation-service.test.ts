import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendarBillMutationService } from "@/features/calendar/lib/bill-mutation-service";
import type { Bill, BillPayment } from "@/features/calendar/schema";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import type {
  BillId,
  BillPaymentId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const now = new Date("2026-04-12T10:00:00.000Z");
const nowIso = "2026-04-12T10:00:00.000Z" as IsoDateTime;

const bill: Bill = {
  id: "bill-1" as BillId,
  name: "Rent",
  amount: 100000 as CopAmount,
  frequency: "monthly",
  categoryId: "home" as CategoryId,
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  isActive: true,
};

describe("calendar bill mutation service", () => {
  type ServiceDeps = Parameters<typeof createCalendarBillMutationService>[0];

  let currentCommit: WriteThroughMutationModule["commit"] | null;
  let currentUserId: UserId | null;
  let requestNotificationPermissions: ServiceDeps["requestNotificationPermissions"];
  let scheduleBillNotifications: ServiceDeps["scheduleBillNotifications"];
  let reportAsyncError: ServiceDeps["reportAsyncError"];
  let addTransactionToCache: ServiceDeps["addTransactionToCache"];
  let removeTransactionFromCache: ServiceDeps["removeTransactionFromCache"];
  let trackCreated: ServiceDeps["trackCreated"];
  let trackPaymentRecorded: ServiceDeps["trackPaymentRecorded"];
  let requestNotificationPermissionsMock: ReturnType<typeof vi.fn>;
  let scheduleBillNotificationsMock: ReturnType<typeof vi.fn>;
  let reportAsyncErrorMock: ReturnType<typeof vi.fn>;
  let addTransactionToCacheMock: ReturnType<typeof vi.fn>;
  let removeTransactionFromCacheMock: ReturnType<typeof vi.fn>;
  let trackCreatedMock: ReturnType<typeof vi.fn>;
  let trackPaymentRecordedMock: ReturnType<typeof vi.fn>;

  function createService() {
    return createCalendarBillMutationService({
      getCommit: () => currentCommit,
      getUserId: () => currentUserId,
      requestNotificationPermissions,
      scheduleBillNotifications,
      reportAsyncError,
      addTransactionToCache,
      removeTransactionFromCache,
      trackCreated,
      trackPaymentRecorded,
      now: () => now,
      createBillId: () => "bill-generated" as BillId,
      createPaymentId: () => "pay-generated" as BillPaymentId,
      createTransactionId: () => "txn-generated" as TransactionId,
    });
  }

  beforeEach(() => {
    currentCommit = vi.fn().mockResolvedValue({ success: true, didMutate: true });
    currentUserId = "user-1" as UserId;
    requestNotificationPermissionsMock = vi.fn().mockResolvedValue(true);
    scheduleBillNotificationsMock = vi.fn().mockResolvedValue(undefined);
    reportAsyncErrorMock = vi.fn();
    addTransactionToCacheMock = vi.fn();
    removeTransactionFromCacheMock = vi.fn();
    trackCreatedMock = vi.fn();
    trackPaymentRecordedMock = vi.fn();
    requestNotificationPermissions =
      requestNotificationPermissionsMock as ServiceDeps["requestNotificationPermissions"];
    scheduleBillNotifications =
      scheduleBillNotificationsMock as ServiceDeps["scheduleBillNotifications"];
    reportAsyncError = reportAsyncErrorMock as ServiceDeps["reportAsyncError"];
    addTransactionToCache = addTransactionToCacheMock as ServiceDeps["addTransactionToCache"];
    removeTransactionFromCache =
      removeTransactionFromCacheMock as ServiceDeps["removeTransactionFromCache"];
    trackCreated = trackCreatedMock as ServiceDeps["trackCreated"];
    trackPaymentRecorded = trackPaymentRecordedMock as ServiceDeps["trackPaymentRecorded"];
  });

  it("adds valid bills through the write-through boundary and schedules notifications", async () => {
    const service = createService();

    const result = await service.addBill({
      name: "Rent",
      amount: "100000",
      frequency: "monthly",
      categoryId: "home" as CategoryId,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
    });
    await Promise.resolve();

    expect(result).toEqual({
      success: true,
      bill: expect.objectContaining({ id: "bill-generated", amount: 100000 }),
    });
    expect(currentCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "calendar.bill.save",
      })
    );
    expect(trackCreatedMock).toHaveBeenCalledWith({ frequency: "monthly" });
    expect(scheduleBillNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bill-generated" })
    );
  });

  it("does not schedule notifications when permissions are denied", async () => {
    requestNotificationPermissionsMock.mockResolvedValue(false);
    const service = createService();

    await service.addBill({
      name: "Rent",
      amount: "100000",
      frequency: "monthly",
      categoryId: "home" as CategoryId,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
    });
    await Promise.resolve();

    expect(scheduleBillNotificationsMock).not.toHaveBeenCalled();
  });

  it("reports async notification failures without failing bill creation", async () => {
    requestNotificationPermissionsMock.mockRejectedValueOnce(new Error("permissions failed"));
    const service = createService();

    await expect(
      service.addBill({
        name: "Rent",
        amount: "100000",
        frequency: "monthly",
        categoryId: "home" as CategoryId,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
      })
    ).resolves.toEqual({
      success: true,
      bill: expect.objectContaining({ id: "bill-generated" }),
    });
    await Promise.resolve();

    expect(reportAsyncErrorMock).toHaveBeenCalledWith(expect.any(Error));

    requestNotificationPermissionsMock.mockResolvedValueOnce(true);
    scheduleBillNotificationsMock.mockRejectedValueOnce(new Error("schedule failed"));

    await expect(
      service.addBill({
        name: "Utilities",
        amount: "50000",
        frequency: "monthly",
        categoryId: "home" as CategoryId,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
      })
    ).resolves.toEqual({
      success: true,
      bill: expect.objectContaining({ id: "bill-generated" }),
    });
    await Promise.resolve();

    expect(reportAsyncErrorMock).toHaveBeenCalledTimes(2);
  });

  it("rejects missing initialization, invalid amounts, and failed commits", async () => {
    currentUserId = null;
    const service = createService();
    await expect(
      service.addBill({
        name: "Rent",
        amount: "100000",
        frequency: "monthly",
        categoryId: "home" as CategoryId,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
      })
    ).resolves.toEqual({ success: false });

    currentUserId = "user-1" as UserId;
    await expect(
      service.addBill({
        name: "Rent",
        amount: "0",
        frequency: "monthly",
        categoryId: "home" as CategoryId,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
      })
    ).resolves.toEqual({ success: false });

    currentCommit = vi.fn().mockResolvedValue({ success: false, error: "db failed" });
    await expect(
      service.addBill({
        name: "Rent",
        amount: "100000",
        frequency: "monthly",
        categoryId: "home" as CategoryId,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
      })
    ).resolves.toEqual({ success: false });
  });

  it("updates bills by normalizing Date fields to ISO strings", async () => {
    const service = createService();

    const didUpdate = await service.updateBill("bill-1" as BillId, {
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      name: "Updated Rent",
    });

    expect(didUpdate).toBe(true);
    expect(currentCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "calendar.bill.update",
        billId: "bill-1",
        fields: expect.objectContaining({
          startDate: "2026-05-01T00:00:00.000Z",
          name: "Updated Rent",
        }),
      })
    );
  });

  it("returns false when updateBill commit throws", async () => {
    currentCommit = vi.fn().mockRejectedValue(new Error("boom"));
    const service = createService();

    await expect(service.updateBill("bill-1" as BillId, { name: "Updated" })).resolves.toBe(false);
  });

  it("returns false for update and delete when commits are unavailable or fail", async () => {
    currentCommit = null;
    const service = createService();
    await expect(service.updateBill("bill-1" as BillId, { name: "Updated" })).resolves.toBe(false);
    await expect(service.deleteBill("bill-1" as BillId)).resolves.toBe(false);

    currentCommit = vi.fn().mockResolvedValue({ success: false, error: "nope" });
    await expect(service.deleteBill("bill-1" as BillId)).resolves.toBe(false);
  });

  it("returns false when deleteBill commit throws", async () => {
    currentCommit = vi.fn().mockRejectedValue(new Error("boom"));
    const service = createService();

    await expect(service.deleteBill("bill-1" as BillId)).resolves.toBe(false);
  });

  it("marks bills paid and updates the transaction cache", async () => {
    const service = createService();

    const result = await service.markBillPaid([bill], bill.id as BillId, "2026-04-12" as IsoDate);

    expect(result).toEqual({
      success: true,
      payment: {
        id: "pay-generated" as BillPaymentId,
        billId: bill.id as BillId,
        dueDate: "2026-04-12" as IsoDate,
        paidAt: nowIso,
        transactionId: "txn-generated" as TransactionId,
        createdAt: nowIso,
      },
    });
    expect(currentCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "calendar.bill.markPaid",
      })
    );
    expect(addTransactionToCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "txn-generated",
        description: "Rent",
      })
    );
    expect(trackPaymentRecordedMock).toHaveBeenCalledOnce();
  });

  it("returns false for markBillPaid when initialization, lookup, or commit fails", async () => {
    const service = createService();
    await expect(
      service.markBillPaid([], bill.id as BillId, "2026-04-12" as IsoDate)
    ).resolves.toEqual({ success: false });

    currentCommit = null;
    await expect(
      service.markBillPaid([bill], bill.id as BillId, "2026-04-12" as IsoDate)
    ).resolves.toEqual({ success: false });

    currentCommit = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      service.markBillPaid([bill], bill.id as BillId, "2026-04-12" as IsoDate)
    ).resolves.toEqual({ success: false });
  });

  it("returns false when markBillPaid receives a failed commit result", async () => {
    currentCommit = vi.fn().mockResolvedValue({ success: false, error: "nope" });
    const service = createService();

    await expect(
      service.markBillPaid([bill], bill.id as BillId, "2026-04-12" as IsoDate)
    ).resolves.toEqual({ success: false });

    expect(addTransactionToCacheMock).not.toHaveBeenCalled();
    expect(trackPaymentRecordedMock).not.toHaveBeenCalled();
  });

  it("loads transaction adapters from the transactions public surface", async () => {
    vi.resetModules();

    const transactionRow = { id: "txn-row" };
    const toTransactionRowMock = vi.fn(() => transactionRow);

    vi.doMock("@/features/transactions/public", () => ({
      toTransactionRow: toTransactionRowMock,
    }));
    vi.doMock("@/features/transactions/lib/build-transaction", () => ({
      toTransactionRow: () => {
        throw new Error("bill mutation service should not import transaction internals");
      },
    }));

    const { createCalendarBillMutationService: createServiceFromPublic } = await import(
      "@/features/calendar/lib/bill-mutation-service"
    );
    const commit = vi.fn().mockResolvedValue({ success: true, didMutate: true });

    const service = createServiceFromPublic({
      getCommit: () => commit,
      getUserId: () => "user-1" as UserId,
      requestNotificationPermissions: async () => true,
      scheduleBillNotifications: vi.fn(),
      reportAsyncError: vi.fn(),
      addTransactionToCache: vi.fn(),
      removeTransactionFromCache: vi.fn(),
      trackCreated: vi.fn(),
      trackPaymentRecorded: vi.fn(),
      now: () => now,
      createPaymentId: () => "pay-generated" as BillPaymentId,
      createTransactionId: () => "txn-generated" as TransactionId,
    });

    await expect(
      service.markBillPaid([bill], bill.id as BillId, "2026-04-12" as IsoDate)
    ).resolves.toEqual({
      success: true,
      payment: expect.objectContaining({ transactionId: "txn-generated" }),
    });

    expect(toTransactionRowMock).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "calendar.bill.markPaid",
        transactionRow,
      })
    );

    vi.doUnmock("@/features/transactions/public");
    vi.doUnmock("@/features/transactions/lib/build-transaction");
    vi.resetModules();
  });

  it("unmarks payments and only clears cache when a linked transaction exists", async () => {
    const service = createService();
    const withTransaction: BillPayment = {
      id: "pay-1" as BillPaymentId,
      billId: bill.id as BillId,
      dueDate: "2026-04-12" as IsoDate,
      paidAt: nowIso,
      transactionId: "txn-1" as TransactionId,
      createdAt: nowIso,
    };

    await expect(
      service.unmarkBillPaid([withTransaction], bill.id as BillId, withTransaction.dueDate)
    ).resolves.toEqual({ success: true });
    expect(removeTransactionFromCacheMock).toHaveBeenCalledWith("txn-1");

    removeTransactionFromCacheMock.mockClear();
    const withoutTransaction: BillPayment = {
      ...withTransaction,
      transactionId: null,
    };
    await expect(
      service.unmarkBillPaid([withoutTransaction], bill.id as BillId, withoutTransaction.dueDate)
    ).resolves.toEqual({ success: true });
    expect(removeTransactionFromCacheMock).not.toHaveBeenCalled();
  });

  it("unmarks payments without cache writes when no matching payment exists", async () => {
    const service = createService();

    await expect(
      service.unmarkBillPaid([], bill.id as BillId, "2026-04-19" as IsoDate)
    ).resolves.toEqual({
      success: true,
    });

    expect(currentCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "calendar.bill.unmarkPaid",
        transactionId: null,
      })
    );
    expect(removeTransactionFromCacheMock).not.toHaveBeenCalled();
  });

  it("returns false when unmarkBillPaid receives a failed commit result", async () => {
    currentCommit = vi.fn().mockResolvedValue({ success: false, error: "nope" });
    const service = createService();
    const withTransaction: BillPayment = {
      id: "pay-1" as BillPaymentId,
      billId: bill.id as BillId,
      dueDate: "2026-04-12" as IsoDate,
      paidAt: nowIso,
      transactionId: "txn-1" as TransactionId,
      createdAt: nowIso,
    };

    await expect(
      service.unmarkBillPaid([withTransaction], bill.id as BillId, withTransaction.dueDate)
    ).resolves.toEqual({ success: false });

    expect(removeTransactionFromCacheMock).not.toHaveBeenCalled();
  });
});
