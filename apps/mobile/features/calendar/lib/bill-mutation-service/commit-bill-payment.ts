import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { toTransactionRow } from "@/features/transactions/query.public";
import { parseIsoDate, toIsoDateTime } from "@/shared/lib";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import { assertCopAmount } from "@/shared/types/assertions";
import type { BillId, BillPaymentId, IsoDate, TransactionId, UserId } from "@/shared/types/branded";
import type { Bill, BillPayment } from "../../schema";

type CommitBillPaymentInput = {
  readonly bill: Bill;
  readonly billId: BillId;
  readonly commit: WriteThroughMutationModule["commit"];
  readonly createPaymentId: () => BillPaymentId;
  readonly createTransactionId: () => TransactionId;
  readonly dueDate: IsoDate;
  readonly timestamp: Date;
  readonly userId: UserId;
};

export function getBillForPayment(bills: readonly Bill[], billId: BillId): Bill | null {
  return bills.find((candidate) => candidate.id === billId) ?? null;
}

async function commitBillPayment({
  bill,
  billId,
  commit,
  createPaymentId,
  createTransactionId,
  dueDate,
  timestamp,
  userId,
}: CommitBillPaymentInput): Promise<{
  transaction: StoredTransaction;
  payment: BillPayment;
} | null> {
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
    voidedAt: null,
    accountId: buildDefaultFinancialAccountId(userId),
    accountAttributionState: "confirmed",
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

export async function commitBillPaymentSafely(input: CommitBillPaymentInput) {
  try {
    return await commitBillPayment(input);
  } catch {
    return null;
  }
}
