import { describe, expect, it, vi } from "vitest";
import { createCalendarQueryService } from "@/features/calendar/services/create-calendar-query-service";
import type {
  BillId,
  BillPaymentId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  UserId,
} from "@/shared/types/branded";

describe("calendar query service", () => {
  it("maps bill rows into calendar bill domain objects", async () => {
    const getAllBills = vi.fn().mockReturnValue([
      {
        id: "bill-1" as BillId,
        userId: "user-1" as UserId,
        name: "Netflix",
        amount: 35000 as CopAmount,
        frequency: "monthly",
        categoryId: "services" as CategoryId,
        startDate: "2026-01-15T00:00:00.000Z" as IsoDate,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-01-01T00:00:00.000Z" as IsoDateTime,
      },
    ]);

    const service = createCalendarQueryService({ getAllBills });
    const bills = await service.loadBills({ db: {} as never, userId: "user-1" as UserId });

    expect(getAllBills).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(bills).toEqual([
      expect.objectContaining({
        id: "bill-1",
        name: "Netflix",
        startDate: expect.any(Date),
      }),
    ]);
  });

  it("uses calendar-month date bounds when loading payments", async () => {
    const getBillPaymentsForMonth = vi.fn().mockReturnValue([
      {
        id: "pay-1" as BillPaymentId,
        billId: "bill-1" as BillId,
        dueDate: "2026-03-15" as IsoDate,
        paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        transactionId: null,
        createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
      },
    ]);

    const service = createCalendarQueryService({ getBillPaymentsForMonth });
    const payments = await service.loadPaymentsForMonth({
      db: {} as never,
      month: new Date(2026, 2, 15),
    });

    expect(getBillPaymentsForMonth).toHaveBeenCalledWith(
      expect.anything(),
      "2026-03-01",
      "2026-03-31"
    );
    expect(payments).toEqual([
      expect.objectContaining({
        id: "pay-1",
        dueDate: "2026-03-15",
      }),
    ]);
  });
});
