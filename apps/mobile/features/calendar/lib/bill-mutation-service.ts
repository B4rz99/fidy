import type { StoredTransaction } from "@/features/transactions/public";
import { toTransactionRow } from "@/features/transactions/public";
import {
  generateBillId,
  generateBillPaymentId,
  generateTransactionId,
  parseDigitsToAmount,
  parseIsoDate,
  toIsoDateTime,
} from "@/shared/lib";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import { assertCopAmount } from "@/shared/types/assertions";
import type {
  BillId,
  BillPaymentId,
  CategoryId,
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
import type { BillUpdateFields } from "./repository";

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

function toBillUpdateFields(fields: UpdateBillFields): BillUpdateFields {
  const amount = fields.amount;
  if (amount != null) {
    assertCopAmount(amount);
  }

  return {
    ...(fields.name != null ? { name: fields.name } : {}),
    ...(amount != null ? { amount } : {}),
    ...(fields.frequency != null ? { frequency: fields.frequency } : {}),
    ...(fields.categoryId != null ? { categoryId: fields.categoryId } : {}),
    ...(fields.startDate != null ? { startDate: fields.startDate.toISOString() } : {}),
    ...(fields.isActive != null ? { isActive: fields.isActive } : {}),
  };
}

function scheduleNotifications(deps: CreateCalendarBillMutationServiceDeps, bill: Bill) {
  void deps
    .requestNotificationPermissions()
    .then((granted) =>
      granted ? Promise.resolve(deps.scheduleBillNotifications(bill)) : undefined
    )
    .catch(deps.reportAsyncError);
}

async function commitBillPayment(
  commit: WriteThroughMutationModule["commit"],
  bill: Bill,
  billId: BillId,
  dueDate: IsoDate,
  userId: UserId,
  timestamp: Date,
  createPaymentId: () => BillPaymentId,
  createTransactionId: () => TransactionId
): Promise<{ transaction: StoredTransaction; payment: BillPayment } | null> {
  const nowIso = toIsoDateTime(timestamp);
  const transactionId = createTransactionId();
  const amount = bill.amount;
  assertCopAmount(amount);

  const transaction: StoredTransaction = {
    id: transactionId,
    userId,
    type: "expense",
    amount,
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

  const result = await commit({
    kind: "calendar.bill.markPaid",
    transactionRow: toTransactionRow(transaction),
    paymentRow: payment,
  });

  if (!result.success) {
    return null;
  }

  return { transaction, payment };
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

      try {
        const dbFields = toBillUpdateFields(fields);
        const result = await commit({
          kind: "calendar.bill.update",
          billId: id,
          fields: dbFields,
          now: toIsoDateTime(now()),
        });

        return result.success;
      } catch {
        return false;
      }
    },

    deleteBill: async (id) => {
      const commit = deps.getCommit();
      if (!commit) {
        return false;
      }

      try {
        const result = await commit({
          kind: "calendar.bill.delete",
          billId: id,
        });

        return result.success;
      } catch {
        return false;
      }
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

      let commitResult: { transaction: StoredTransaction; payment: BillPayment } | null = null;

      try {
        commitResult = await commitBillPayment(
          commit,
          bill,
          billId,
          dueDate,
          userId,
          now(),
          createPaymentId,
          createTransactionId
        );
      } catch {
        return { success: false };
      }

      if (!commitResult) {
        return { success: false };
      }

      try {
        deps.addTransactionToCache(commitResult.transaction);
        deps.trackPaymentRecorded();
      } catch (error) {
        deps.reportAsyncError(error);
      }

      return { success: true, payment: commitResult.payment };
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
