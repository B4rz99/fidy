// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteBill,
  deleteBillPayment,
  getAllBills,
  getBillPaymentsForMonth,
  insertBill,
  insertBillPayment,
  updateBill,
} from "@/features/calendar/lib/repository";
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

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const CREATED_AT = "2026-03-01T00:00:00.000Z" as IsoDateTime;
const UPDATED_AT = "2026-03-02T12:00:00.000Z" as IsoDateTime;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

const insertBillRow = (
  overrides: Partial<{
    id: BillId;
    userId: UserId;
    name: string;
    amount: CopAmount;
    frequency: string;
    categoryId: CategoryId;
    startDate: IsoDate;
    isActive: boolean;
  }> = {}
) =>
  insertBill(db as any, {
    id: overrides.id ?? ("bill-1" as BillId),
    userId: overrides.userId ?? USER_ID,
    name: overrides.name ?? "Internet",
    amount: overrides.amount ?? (120000 as CopAmount),
    frequency: overrides.frequency ?? "monthly",
    categoryId: overrides.categoryId ?? ("services" as CategoryId),
    startDate: overrides.startDate ?? ("2026-03-01" as IsoDate),
    isActive: overrides.isActive ?? true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });

const insertBillPaymentRow = (
  overrides: Partial<{
    id: BillPaymentId;
    billId: BillId;
    dueDate: IsoDate;
    paidAt: IsoDateTime;
    transactionId: TransactionId | null;
  }> = {}
) =>
  insertBillPayment(db as any, {
    id: overrides.id ?? ("payment-1" as BillPaymentId),
    billId: overrides.billId ?? ("bill-1" as BillId),
    dueDate: overrides.dueDate ?? ("2026-04-05" as IsoDate),
    paidAt: overrides.paidAt ?? ("2026-04-05T10:00:00.000Z" as IsoDateTime),
    transactionId: overrides.transactionId ?? null,
    createdAt: CREATED_AT,
  });

describe("calendar repository", () => {
  it("removes deleted bill payments from monthly reads and cleans up dependent rows", () => {
    insertBillRow();
    insertBillRow({
      id: "bill-2" as BillId,
      name: "Water",
      amount: 80000 as CopAmount,
      categoryId: "utilities" as CategoryId,
    });

    updateBill(
      db as any,
      "bill-1" as BillId,
      {
        name: "Home Internet",
        amount: 135000 as CopAmount,
        isActive: false,
      },
      UPDATED_AT
    );

    expect(getAllBills(db as any, USER_ID)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "bill-1",
          name: "Home Internet",
          amount: 135000,
          isActive: false,
          updatedAt: UPDATED_AT,
        }),
        expect.objectContaining({
          id: "bill-2",
          name: "Water",
        }),
      ])
    );

    insertBillPaymentRow({
      id: "payment-1" as BillPaymentId,
      billId: "bill-1" as BillId,
      dueDate: "2026-04-05" as IsoDate,
      transactionId: "tx-1" as TransactionId,
    });
    insertBillPaymentRow({
      id: "payment-2" as BillPaymentId,
      billId: "bill-1" as BillId,
      dueDate: "2026-04-20" as IsoDate,
      paidAt: "2026-04-20T10:00:00.000Z" as IsoDateTime,
      transactionId: "tx-2" as TransactionId,
    });
    insertBillPaymentRow({
      id: "payment-3" as BillPaymentId,
      billId: "bill-2" as BillId,
      dueDate: "2026-04-10" as IsoDate,
      paidAt: "2026-04-10T10:00:00.000Z" as IsoDateTime,
      transactionId: "tx-3" as TransactionId,
    });
    insertBillPaymentRow({
      id: "payment-4" as BillPaymentId,
      billId: "bill-2" as BillId,
      dueDate: "2026-05-02" as IsoDate,
      paidAt: "2026-05-02T10:00:00.000Z" as IsoDateTime,
      transactionId: "tx-4" as TransactionId,
    });

    deleteBillPayment(db as any, "bill-2" as BillId, "2026-04-10" as IsoDate);

    expect(
      getBillPaymentsForMonth(db as any, "2026-04-01" as IsoDate, "2026-04-30" as IsoDate)
        .map(({ id }) => id)
        .sort()
    ).toEqual(["payment-1", "payment-2"]);

    deleteBill(db as any, "bill-1" as BillId);

    expect(getAllBills(db as any, USER_ID).map(({ id }) => id)).toEqual(["bill-2"]);
    expect(
      getBillPaymentsForMonth(db as any, "2026-04-01" as IsoDate, "2026-04-30" as IsoDate)
    ).toEqual([]);
    expect(
      getBillPaymentsForMonth(db as any, "2026-05-01" as IsoDate, "2026-05-31" as IsoDate).map(
        ({ id }) => id
      )
    ).toEqual(["payment-4"]);
  });
});
