import type { AnyDb } from "@/shared/db/client";
import type {
  billPayments,
  bills,
  budgets,
  categoryColorOverrides,
  categoryIconOverrides,
  captureEvidence,
  goalContributions,
  goals,
  notifications,
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
  transactions,
  userCategories,
} from "@/shared/db/schema";
import type {
  BillId,
  BudgetId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  Month,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type MutationEffect = () => void | Promise<void>;

export type MutationOutcome =
  | { success: true; didMutate: boolean }
  | { success: false; error: string };

type PersistedTransactionRow = typeof transactions.$inferInsert;
type TransactionRow = Omit<
  PersistedTransactionRow,
  "accountId" | "accountAttributionState" | "supersededAt" | "source"
> & {
  accountId?: PersistedTransactionRow["accountId"];
  accountAttributionState?: PersistedTransactionRow["accountAttributionState"];
  supersededAt?: PersistedTransactionRow["supersededAt"];
  source?: PersistedTransactionRow["source"];
};
type GoalRow = typeof goals.$inferInsert;
type GoalContributionRow = typeof goalContributions.$inferInsert;
type BudgetRow = typeof budgets.$inferInsert;
type NotificationRow = typeof notifications.$inferInsert;
type UserCategoryRow = typeof userCategories.$inferInsert;
type CategoryIconOverrideRow = typeof categoryIconOverrides.$inferInsert;
type CategoryColorOverrideRow = typeof categoryColorOverrides.$inferInsert;
type BillRow = typeof bills.$inferInsert;
type BillPaymentRow = typeof billPayments.$inferInsert;
type ProcessedSourceEventRow = typeof processedSourceEvents.$inferInsert;
type ReviewCandidateRow = typeof reviewCandidates.$inferInsert;
type CaptureEvidenceRow = typeof captureEvidence.$inferInsert;
type ReviewCandidateCaptureEvidenceRow = typeof reviewCandidateCaptureEvidence.$inferInsert;

type TransactionSaveCommand = {
  kind: "transaction.save";
  mode: "insert" | "update";
  row: TransactionRow;
  afterCommit?: readonly MutationEffect[];
};

type TransactionDeleteCommand = {
  kind: "transaction.delete";
  transactionId: TransactionId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type GoalSaveCommand = {
  kind: "goal.save";
  row: GoalRow;
  afterCommit?: readonly MutationEffect[];
};

type GoalUpdateCommand = {
  kind: "goal.update";
  goalId: string;
  data: Partial<
    Pick<
      GoalRow,
      "name" | "targetAmount" | "targetDate" | "interestRatePercent" | "iconName" | "colorHex"
    >
  >;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type GoalDeleteCommand = {
  kind: "goal.delete";
  goalId: string;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type GoalContributionSaveCommand = {
  kind: "goalContribution.save";
  row: GoalContributionRow;
  afterCommit?: readonly MutationEffect[];
};

type GoalContributionDeleteCommand = {
  kind: "goalContribution.delete";
  contributionId: string;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type BudgetSaveCommand = {
  kind: "budget.save";
  row: BudgetRow;
  afterCommit?: readonly MutationEffect[];
};

type BudgetUpdateCommand = {
  kind: "budget.update";
  budgetId: BudgetId;
  categoryId: CategoryId;
  amount: CopAmount;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type BudgetDeleteCommand = {
  kind: "budget.delete";
  budgetId: BudgetId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type BudgetCopyCommand = {
  kind: "budget.copy";
  sourceMonth: Month;
  targetMonth: Month;
  userId: UserId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type NotificationInsertCommand = {
  kind: "notification.insert";
  row: NotificationRow;
  afterCommit?: readonly MutationEffect[];
};

type NotificationClearAllCommand = {
  kind: "notification.clearAll";
  userId: UserId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type CategorySaveCommand = {
  kind: "category.save";
  row: UserCategoryRow;
  afterCommit?: readonly MutationEffect[];
};

type CategoryIconOverrideSaveCommand = {
  kind: "categoryIconOverride.save";
  row: CategoryIconOverrideRow;
  afterCommit?: readonly MutationEffect[];
};

type CategoryIconOverrideClearCommand = {
  kind: "categoryIconOverride.clear";
  userId: UserId;
  categoryId: CategoryId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type CategoryColorOverrideSaveCommand = {
  kind: "categoryColorOverride.save";
  row: CategoryColorOverrideRow;
  afterCommit?: readonly MutationEffect[];
};

type CategoryColorOverrideClearCommand = {
  kind: "categoryColorOverride.clear";
  userId: UserId;
  categoryId: CategoryId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillUpdateFields = {
  name?: string;
  amount?: CopAmount;
  frequency?: BillRow["frequency"];
  categoryId?: CategoryId;
  startDate?: string;
  isActive?: boolean;
};

type CalendarBillSaveCommand = {
  kind: "calendar.bill.save";
  row: BillRow;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillUpdateCommand = {
  kind: "calendar.bill.update";
  billId: BillId;
  fields: CalendarBillUpdateFields;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillDeleteCommand = {
  kind: "calendar.bill.delete";
  billId: BillId;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillMarkPaidCommand = {
  kind: "calendar.bill.markPaid";
  paymentRow: BillPaymentRow;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillUnmarkPaidCommand = {
  kind: "calendar.bill.unmarkPaid";
  userId: UserId;
  billId: BillId;
  dueDate: IsoDate;
  transactionId: TransactionId | null;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type LocalLedgerReviewCandidateCreateCommand = {
  kind: "localLedger.reviewCandidate.create";
  sourceEvent: Omit<ProcessedSourceEventRow, "deletedAt">;
  candidate: Omit<ReviewCandidateRow, "deletedAt">;
  evidence: readonly (Omit<CaptureEvidenceRow, "transactionId" | "transferId" | "deletedAt"> & {
    linkId: ReviewCandidateCaptureEvidenceRow["id"];
  })[];
  afterCommit?: readonly MutationEffect[];
};

type LocalLedgerReviewCandidateResolveCommand = {
  kind: "localLedger.reviewCandidate.resolve";
  userId: UserId;
  reviewCandidateId: ReviewCandidateId;
  processedSourceEventId: ProcessedSourceEventId;
  reviewCandidateStatus: "accepted" | "rejected";
  processedSourceEventStatus: "processed" | "dismissed";
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

export type MutationCommand =
  | TransactionSaveCommand
  | TransactionDeleteCommand
  | GoalSaveCommand
  | GoalUpdateCommand
  | GoalDeleteCommand
  | GoalContributionSaveCommand
  | GoalContributionDeleteCommand
  | BudgetSaveCommand
  | BudgetUpdateCommand
  | BudgetDeleteCommand
  | BudgetCopyCommand
  | NotificationInsertCommand
  | NotificationClearAllCommand
  | CategorySaveCommand
  | CategoryIconOverrideSaveCommand
  | CategoryIconOverrideClearCommand
  | CategoryColorOverrideSaveCommand
  | CategoryColorOverrideClearCommand
  | CalendarBillSaveCommand
  | CalendarBillUpdateCommand
  | CalendarBillDeleteCommand
  | CalendarBillMarkPaidCommand
  | CalendarBillUnmarkPaidCommand
  | LocalLedgerReviewCandidateCreateCommand
  | LocalLedgerReviewCandidateResolveCommand;

type TransactionCallback = Parameters<AnyDb["transaction"]>[0];
export type MutationDb = Parameters<TransactionCallback>[0];
