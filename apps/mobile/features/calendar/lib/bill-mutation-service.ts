import { toTransactionRow } from "@/features/transactions/lib/build-transaction";
import type { StoredTransaction } from "@/features/transactions/schema";
import {
  generateBillId,
  generateBillPaymentId,
  generateTransactionId,
  parseDigitsToAmount,
  parseIsoDate,
  toIsoDateTime,
} from "@/shared/lib";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import type {
  BillId,
  BillPaymentId,
  CategoryId,
  CopAmount,
  IsoDate,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import {
  type Bill,
  type BillFrequency,
  type BillPayment,
  createBillSchema,
  toBillRow,
} from "../schema";
import type { BillPaymentRow, BillRow } from "./repository";

type AddBillInput = {
  name: string;
  amount: string;
  frequency: BillFrequency;
  categoryId: CategoryId;
  startDate: Date;
};

type UpdateBillFields = Partial<
  Pick<Bill, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
>;

type AddBillResult = { success: true; bill: Bill } | { success: false };
type MarkBillPaidResult = { success: true; payment: BillPayment } | { success: false };
type UnmarkBillPaidResult = { success: true } | { success: false };

type CreateCalendarBillMutationServiceDeps = {
  getCommit: () => WriteThroughMutationModule["commit"] | null;
  getUserId: () => UserId | null;
  requestNotificationPermissions: () => Promise<boolean>;
  scheduleBillNotifications: (bill: Bill) => unknown;
  reportAsyncError: (error: unknown) => void;
  addTransactionToCache: (transaction: StoredTransaction) => void;
  removeTransactionFromCache: (transactionId: TransactionId) => void;
  trackCreated: (input: { frequency: BillFrequency }) => void;
  trackPaymentRecorded: () => void;
  now?: () => Date;
  createBillId?: () => BillId;
  createPaymentId?: () => BillPaymentId;
  createTransactionId?: () => TransactionId;
};

export type CalendarBillMutationService = {
  addBill: (input: AddBillInput) => Promise<AddBillResult>;
  updateBill: (id: BillId, fields: UpdateBillFields) => Promise<boolean>;
  deleteBill: (id: BillId) => Promise<boolean>;
  markBillPaid: (
    bills: readonly Bill[],
    billId: BillId,
    dueDate: IsoDate
  ) => Promise<MarkBillPaidResult>;
  unmarkBillPaid: (
    payments: readonly BillPayment[],
    billId: BillId,
    dueDate: IsoDate
  ) => Promise<UnmarkBillPaidResult>;
};

function scheduleNotifications(deps: CreateCalendarBillMutationServiceDeps, bill: Bill) {
  void deps
    .requestNotificationPermissions()
    .then((granted) =>
      granted ? Promise.resolve(deps.scheduleBillNotifications(bill)) : undefined
    )
    .catch(deps.reportAsyncError);
}

export function createCalendarBillMutationService(
  deps: CreateCalendarBillMutationServiceDeps
): CalendarBillMutationService {
  const now = deps.now ?? (() => new Date());
  const createBillId = deps.createBillId ?? generateBillId;
  const createPaymentId = deps.createPaymentId ?? generateBillPaymentId;
  const createTransactionId = deps.createTransactionId ?? generateTransactionId;

  return {
    addBill: async (input) => {
      const userId = deps.getUserId();
      const commit = deps.getCommit();
      if (!userId || !commit) {
        return { success: false };
      }

      const amountValue = parseDigitsToAmount(input.amount);
      if (amountValue <= 0) {
        return { success: false };
      }

      const parsed = createBillSchema.safeParse({
        name: input.name,
        amount: amountValue,
        frequency: input.frequency,
        categoryId: input.categoryId,
        startDate: input.startDate,
        isActive: true,
      });
      if (!parsed.success) {
        return { success: false };
      }

      const bill: Bill = {
        id: createBillId(),
        ...parsed.data,
      };

      try {
        const result = await commit({
          kind: "calendar.bill.save",
          row: toBillRow(bill, userId, toIsoDateTime(now())),
        });
        if (!result.success) {
          return { success: false };
        }
      } catch {
        return { success: false };
      }

      deps.trackCreated({ frequency: input.frequency });
      scheduleNotifications(deps, bill);
      return { success: true, bill };
    },

    updateBill: async (id, fields) => {
      const commit = deps.getCommit();
      if (!commit) {
        return false;
      }

      const dbFields = Object.fromEntries(
        Object.entries(fields)
          .filter(([, value]) => value != null)
          .map(([key, value]) => [
            key,
            key === "startDate" && value instanceof Date ? value.toISOString() : value,
          ])
      );

      const result = await commit({
        kind: "calendar.bill.update",
        billId: id,
        fields: dbFields as Partial<
          Pick<BillRow, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
        >,
        now: toIsoDateTime(now()),
      });

      return result.success;
    },

    deleteBill: async (id) => {
      const commit = deps.getCommit();
      if (!commit) {
        return false;
      }

      const result = await commit({
        kind: "calendar.bill.delete",
        billId: id,
      });

      return result.success;
    },

    markBillPaid: async (bills, billId, dueDate) => {
      const userId = deps.getUserId();
      const commit = deps.getCommit();
      if (!userId || !commit) {
        return { success: false };
      }

      const bill = bills.find((candidate) => candidate.id === billId);
      if (!bill) {
        return { success: false };
      }

      const timestamp = now();
      const nowIso = toIsoDateTime(timestamp);
      const transactionId = createTransactionId();
      const transaction: StoredTransaction = {
        id: transactionId,
        userId,
        type: "expense",
        amount: bill.amount as CopAmount,
        categoryId: bill.categoryId,
        description: bill.name,
        date: parseIsoDate(dueDate),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };

      const payment: BillPayment = {
        id: createPaymentId(),
        billId,
        dueDate,
        paidAt: nowIso,
        transactionId,
        createdAt: nowIso,
      };

      try {
        const result = await commit({
          kind: "calendar.bill.markPaid",
          transactionRow: toTransactionRow(transaction),
          paymentRow: payment as BillPaymentRow,
        });
        if (!result.success) {
          return { success: false };
        }
      } catch {
        return { success: false };
      }

      deps.addTransactionToCache(transaction);
      deps.trackPaymentRecorded();
      return { success: true, payment };
    },

    unmarkBillPaid: async (payments, billId, dueDate) => {
      const commit = deps.getCommit();
      if (!commit) {
        return { success: false };
      }

      const payment = payments.find(
        (candidate) => candidate.billId === billId && candidate.dueDate === dueDate
      );

      try {
        const result = await commit({
          kind: "calendar.bill.unmarkPaid",
          billId,
          dueDate,
          transactionId: payment?.transactionId ?? null,
          now: toIsoDateTime(now()),
        });
        if (!result.success) {
          return { success: false };
        }
      } catch {
        return { success: false };
      }

      if (payment?.transactionId) {
        deps.removeTransactionFromCache(payment.transactionId);
      }

      return { success: true };
    },
  };
}
