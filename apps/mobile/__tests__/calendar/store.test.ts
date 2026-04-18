import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBill,
  deleteBill,
  initializeCalendarSession,
  loadBills,
  markBillPaid,
  nextMonth,
  unmarkBillPaid,
  updateBill,
  useCalendarStore,
} from "@/features/calendar/store";
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

const mockLoadBills = vi.fn();
const mockLoadPaymentsForMonth = vi.fn();
const mockAddBill = vi.fn();
const mockDeleteBill = vi.fn();
const mockMarkBillPaid = vi.fn();
const mockUnmarkBillPaid = vi.fn();
const mockUpdateBill = vi.fn();

vi.mock("@/features/calendar/services/create-calendar-query-service", () => ({
  createCalendarQueryService: () => ({
    loadBills: (...args: unknown[]) => mockLoadBills(...args),
    loadPaymentsForMonth: (...args: unknown[]) => mockLoadPaymentsForMonth(...args),
  }),
}));

vi.mock("@/features/calendar/lib/bill-mutation-service", () => ({
  createCalendarBillMutationService: () => ({
    addBill: (...args: unknown[]) => mockAddBill(...args),
    updateBill: (...args: unknown[]) => mockUpdateBill(...args),
    deleteBill: (...args: unknown[]) => mockDeleteBill(...args),
    markBillPaid: (...args: unknown[]) => mockMarkBillPaid(...args),
    unmarkBillPaid: (...args: unknown[]) => mockUnmarkBillPaid(...args),
  }),
}));

vi.mock("@/mutations", () => ({
  createWriteThroughMutationModule: () => ({
    commit: vi.fn(),
  }),
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("calendar store boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCalendarStore.setState({
      activeUserId: null,
      currentMonth: new Date(2026, 2, 1),
      bills: [],
      payments: [],
      isLoading: false,
    });
  });

  it("drops stale bill results after the active user changes", async () => {
    const deferred =
      createDeferred<
        readonly {
          id: BillId;
          name: string;
          amount: CopAmount;
          frequency: "monthly";
          categoryId: CategoryId;
          startDate: Date;
          isActive: boolean;
        }[]
      >();
    mockLoadBills.mockReturnValueOnce(deferred.promise);

    initializeCalendarSession("user-1" as UserId);
    const load = loadBills({} as never, "user-1" as UserId);

    initializeCalendarSession("user-2" as UserId);
    deferred.resolve([
      {
        id: "bill-1" as BillId,
        name: "Netflix",
        amount: 35000 as CopAmount,
        frequency: "monthly",
        categoryId: "services" as CategoryId,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        isActive: true,
      },
    ]);

    await load;

    expect(useCalendarStore.getState()).toMatchObject({
      activeUserId: "user-2",
      bills: [],
      isLoading: false,
    });
  });

  it("advances the month and reloads payments through the explicit boundary", async () => {
    mockLoadPaymentsForMonth.mockResolvedValueOnce([
      {
        id: "pay-1" as BillPaymentId,
        billId: "bill-1" as BillId,
        dueDate: "2026-04-15" as IsoDate,
        paidAt: "2026-04-10T00:00:00.000Z" as IsoDateTime,
        transactionId: null,
        createdAt: "2026-04-10T00:00:00.000Z" as IsoDateTime,
      },
    ]);

    initializeCalendarSession("user-1" as UserId);
    await nextMonth({} as never);

    expect(mockLoadPaymentsForMonth).toHaveBeenCalledWith({
      db: expect.anything(),
      month: new Date(2026, 3, 1),
    });
    expect(useCalendarStore.getState()).toMatchObject({
      currentMonth: new Date(2026, 3, 1),
      payments: [expect.objectContaining({ id: "pay-1" })],
    });
  });

  it("appends a bill when the explicit add boundary succeeds", async () => {
    mockAddBill.mockResolvedValueOnce({
      success: true,
      bill: {
        id: "bill-1" as BillId,
        name: "Netflix",
        amount: 35000 as CopAmount,
        frequency: "monthly",
        categoryId: "services" as CategoryId,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        isActive: true,
      },
    });
    initializeCalendarSession("user-1" as UserId);

    const result = await addBill(
      {} as never,
      "user-1" as UserId,
      "Netflix",
      "35000",
      "monthly",
      "services" as CategoryId,
      new Date("2026-01-15T00:00:00.000Z")
    );

    expect(result).toBe(true);
    expect(useCalendarStore.getState().bills).toEqual([
      expect.objectContaining({
        id: "bill-1",
        name: "Netflix",
      }),
    ]);
  });

  it("drops stale bill mutation results after the active user changes", async () => {
    const deferred = createDeferred<{
      success: true;
      bill: {
        id: BillId;
        name: string;
        amount: CopAmount;
        frequency: "monthly";
        categoryId: CategoryId;
        startDate: Date;
        isActive: boolean;
      };
    }>();
    mockAddBill.mockReturnValueOnce(deferred.promise);

    initializeCalendarSession("user-1" as UserId);
    const add = addBill(
      {} as never,
      "user-1" as UserId,
      "Netflix",
      "35000",
      "monthly",
      "services" as CategoryId,
      new Date("2026-01-15T00:00:00.000Z")
    );

    initializeCalendarSession("user-2" as UserId);
    deferred.resolve({
      success: true,
      bill: {
        id: "bill-1" as BillId,
        name: "Netflix",
        amount: 35000 as CopAmount,
        frequency: "monthly",
        categoryId: "services" as CategoryId,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        isActive: true,
      },
    });

    await expect(add).resolves.toBe(false);
    expect(useCalendarStore.getState()).toMatchObject({
      activeUserId: "user-2",
      bills: [],
    });
  });

  it("drops stale update results after the active user changes", async () => {
    const deferred = createDeferred<boolean>();
    mockUpdateBill.mockReturnValueOnce(deferred.promise);
    useCalendarStore.setState({
      bills: [
        {
          id: "bill-1" as BillId,
          name: "Netflix",
          amount: 35000 as CopAmount,
          frequency: "monthly",
          categoryId: "services" as CategoryId,
          startDate: new Date("2026-01-15T00:00:00.000Z"),
          isActive: true,
        },
      ],
    });

    initializeCalendarSession("user-1" as UserId);
    const update = updateBill({} as never, "user-1" as UserId, "bill-1" as BillId, {
      name: "Hulu",
    });

    initializeCalendarSession("user-2" as UserId);
    deferred.resolve(true);

    await expect(update).resolves.toBe(false);
    expect(useCalendarStore.getState()).toMatchObject({
      activeUserId: "user-2",
      bills: [],
    });
  });

  it("removes a deleted bill and its payments from state", async () => {
    useCalendarStore.setState({
      bills: [
        {
          id: "bill-1" as BillId,
          name: "Netflix",
          amount: 35000 as CopAmount,
          frequency: "monthly",
          categoryId: "services" as CategoryId,
          startDate: new Date("2026-01-15T00:00:00.000Z"),
          isActive: true,
        },
      ],
      payments: [
        {
          id: "pay-1" as BillPaymentId,
          billId: "bill-1" as BillId,
          dueDate: "2026-03-15" as IsoDate,
          paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
          transactionId: null,
          createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        },
      ],
    });
    mockDeleteBill.mockResolvedValueOnce(true);
    initializeCalendarSession("user-1" as UserId);

    await deleteBill({} as never, "user-1" as UserId, "bill-1" as BillId);

    expect(useCalendarStore.getState()).toMatchObject({
      bills: [],
      payments: [],
    });
  });

  it("updates payment state through the paid and unpaid boundaries", async () => {
    useCalendarStore.setState({
      bills: [
        {
          id: "bill-1" as BillId,
          name: "Netflix",
          amount: 35000 as CopAmount,
          frequency: "monthly",
          categoryId: "services" as CategoryId,
          startDate: new Date("2026-01-15T00:00:00.000Z"),
          isActive: true,
        },
      ],
    });
    mockMarkBillPaid.mockResolvedValueOnce({
      success: true,
      payment: {
        id: "pay-1" as BillPaymentId,
        billId: "bill-1" as BillId,
        dueDate: "2026-03-15" as IsoDate,
        paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        transactionId: "txn-1" as TransactionId,
        createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
      },
    });
    mockUnmarkBillPaid.mockResolvedValueOnce({ success: true });
    initializeCalendarSession("user-1" as UserId);

    await markBillPaid(
      {} as never,
      "user-1" as UserId,
      "bill-1" as BillId,
      "2026-03-15" as IsoDate
    );
    expect(useCalendarStore.getState().payments).toEqual([
      expect.objectContaining({
        id: "pay-1",
        transactionId: "txn-1",
      }),
    ]);

    await unmarkBillPaid(
      {} as never,
      "user-1" as UserId,
      "bill-1" as BillId,
      "2026-03-15" as IsoDate
    );
    expect(useCalendarStore.getState().payments).toEqual([]);
  });

  it("drops stale payment mutation results after the active user changes", async () => {
    const deferred = createDeferred<{
      success: true;
      payment: {
        id: BillPaymentId;
        billId: BillId;
        dueDate: IsoDate;
        paidAt: IsoDateTime;
        transactionId: TransactionId;
        createdAt: IsoDateTime;
      };
    }>();
    useCalendarStore.setState({
      bills: [
        {
          id: "bill-1" as BillId,
          name: "Netflix",
          amount: 35000 as CopAmount,
          frequency: "monthly",
          categoryId: "services" as CategoryId,
          startDate: new Date("2026-01-15T00:00:00.000Z"),
          isActive: true,
        },
      ],
    });
    mockMarkBillPaid.mockReturnValueOnce(deferred.promise);

    initializeCalendarSession("user-1" as UserId);
    const mark = markBillPaid(
      {} as never,
      "user-1" as UserId,
      "bill-1" as BillId,
      "2026-03-15" as IsoDate
    );

    initializeCalendarSession("user-2" as UserId);
    deferred.resolve({
      success: true,
      payment: {
        id: "pay-1" as BillPaymentId,
        billId: "bill-1" as BillId,
        dueDate: "2026-03-15" as IsoDate,
        paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        transactionId: "txn-1" as TransactionId,
        createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
      },
    });

    await mark;
    expect(useCalendarStore.getState()).toMatchObject({
      activeUserId: "user-2",
      payments: [],
    });
  });
});
