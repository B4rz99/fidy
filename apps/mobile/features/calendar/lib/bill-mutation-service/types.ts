import type { StoredTransaction } from "@/features/transactions/query.public";
import type { WriteThroughMutationModule } from "@/shared/mutations";
import type {
  BillId,
  BillPaymentId,
  CategoryId,
  IsoDate,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { Bill, BillFrequency, BillPayment } from "../../schema";

export type AddBillInput = {
  readonly amount: string;
  readonly categoryId: CategoryId;
  readonly frequency: BillFrequency;
  readonly name: string;
  readonly startDate: Date;
};

export type UpdateBillFields = Partial<
  Pick<Bill, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
>;

export type AddBillResult = { success: true; bill: Bill } | { success: false };
export type MarkBillPaidResult = { success: true; payment: BillPayment } | { success: false };
export type UnmarkBillPaidResult = { success: true } | { success: false };

export type CreateCalendarBillMutationServiceDeps = {
  getCommit: () => WriteThroughMutationModule["commit"] | null;
  getUserId: () => UserId | null;
  recordBillPayment: (input: {
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
