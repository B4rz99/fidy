import type { StoredTransaction } from "@/features/transactions/query.public";
import { toIsoDateTime } from "@/shared/lib";
import { assertCopAmount } from "@/shared/types/assertions";
import type { BillId, BillPaymentId, IsoDate, TransactionId, UserId } from "@/shared/types/branded";
import type { Bill, BillPayment } from "../../schema";

type CommitBillPaymentInput = {
  readonly bill: Bill;
  readonly billId: BillId;
  readonly createPaymentId: () => BillPaymentId;
  readonly createTransactionId: () => TransactionId;
  readonly dueDate: IsoDate;
  readonly recordBillPayment: (input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly payment: BillPayment;
    readonly bill: Bill;
    readonly dueDate: IsoDate;
    readonly now: Date;
  }) => Promise<
    | { readonly success: true; readonly transaction: StoredTransaction }
    | { readonly success: false }
  >;
  readonly timestamp: Date;
  readonly userId: UserId;
};

export function getBillForPayment(bills: readonly Bill[], billId: BillId): Bill | null {
  return bills.find((candidate) => candidate.id === billId) ?? null;
}

async function commitBillPayment({
  bill,
  billId,
  createPaymentId,
  createTransactionId,
  dueDate,
  recordBillPayment,
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

  const payment: BillPayment = {
    id: createPaymentId(),
    billId,
    dueDate,
    paidAt: nowIso,
    transactionId,
    createdAt: nowIso,
  };

  const result = await recordBillPayment({
    userId,
    transactionId,
    payment,
    bill,
    dueDate,
    now: timestamp,
  });

  if (!result.success) return null;

  return { transaction: result.transaction, payment };
}

export async function commitBillPaymentSafely(input: CommitBillPaymentInput) {
  try {
    return await commitBillPayment(input);
  } catch {
    return null;
  }
}
