import {
  generateBillId,
  generateBillPaymentId,
  generateTransactionId,
  parseDigitsToAmount,
  toIsoDateTime,
} from "@/shared/lib";
import { createBillSchema, toBillRow } from "../schema";
import { applyBillPaymentSideEffects } from "./bill-mutation-service/bill-payment-effects";
import {
  commitBillPaymentSafely,
  getBillForPayment,
} from "./bill-mutation-service/commit-bill-payment";
import { scheduleNotifications } from "./bill-mutation-service/notifications";
import { toBillUpdateFields } from "./bill-mutation-service/to-bill-update-fields";
import type {
  CalendarBillMutationService,
  CreateCalendarBillMutationServiceDeps,
} from "./bill-mutation-service/types";

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

      const bill = {
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
        const result = await commit({
          kind: "calendar.bill.update",
          billId: id,
          fields: toBillUpdateFields(fields),
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
      const bill = getBillForPayment(bills, billId);
      if (!userId || bill == null) {
        return { success: false };
      }

      const commitResult = await commitBillPaymentSafely({
        bill,
        billId,
        dueDate,
        userId,
        timestamp: now(),
        recordBillPayment: deps.recordBillPayment,
        createPaymentId,
        createTransactionId,
      });
      if (!commitResult) {
        return { success: false };
      }

      applyBillPaymentSideEffects(deps, commitResult.transaction);
      return { success: true, payment: commitResult.payment };
    },

    unmarkBillPaid: async (payments, billId, dueDate) => {
      const commit = deps.getCommit();
      const userId = deps.getUserId();
      if (!commit || !userId) {
        return { success: false };
      }

      const payment = payments.find(
        (candidate) => candidate.billId === billId && candidate.dueDate === dueDate
      );

      try {
        const result = await commit({
          kind: "calendar.bill.unmarkPaid",
          userId,
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
