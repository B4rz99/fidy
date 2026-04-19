import type { TransactionRow as RepoTransactionRow } from "@/features/transactions/lib/repository";
import type {
  AnyDb,
  billPayments,
  bills,
  budgets,
  goalContributions,
  goals,
  notifications,
  SyncOperation,
  SyncTableName,
  userCategories,
} from "@/shared/db";
import { generateBudgetId, generateSyncQueueId } from "@/shared/lib";
import type {
  BillId,
  BudgetId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  Month,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type MutationEffect = () => void | Promise<void>;

export type MutationOutcome =
  | { success: true; didMutate: boolean }
  | { success: false; error: string };

type TransactionRow = RepoTransactionRow;
type GoalRow = typeof goals.$inferInsert;
type GoalContributionRow = typeof goalContributions.$inferInsert;
type BudgetRow = typeof budgets.$inferInsert;
type NotificationRow = typeof notifications.$inferInsert;
type UserCategoryRow = typeof userCategories.$inferInsert;
type BillRow = typeof bills.$inferInsert;
type BillPaymentRow = typeof billPayments.$inferInsert;

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
  transactionRow: TransactionRow;
  paymentRow: BillPaymentRow;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillUnmarkPaidCommand = {
  kind: "calendar.bill.unmarkPaid";
  billId: BillId;
  dueDate: IsoDate;
  transactionId: TransactionId | null;
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
  | CalendarBillSaveCommand
  | CalendarBillUpdateCommand
  | CalendarBillDeleteCommand
  | CalendarBillMarkPaidCommand
  | CalendarBillUnmarkPaidCommand;

export type MutationPolicy = "local-only" | "sync-backed";

const MUTATION_POLICY: Record<MutationCommand["kind"], MutationPolicy> = {
  "transaction.save": "sync-backed",
  "transaction.delete": "sync-backed",
  "goal.save": "sync-backed",
  "goal.update": "sync-backed",
  "goal.delete": "sync-backed",
  "goalContribution.save": "sync-backed",
  "goalContribution.delete": "sync-backed",
  "budget.save": "sync-backed",
  "budget.update": "sync-backed",
  "budget.delete": "sync-backed",
  "budget.copy": "sync-backed",
  "notification.insert": "sync-backed",
  "notification.clearAll": "sync-backed",
  "category.save": "sync-backed",
  "calendar.bill.save": "local-only",
  "calendar.bill.update": "local-only",
  "calendar.bill.delete": "local-only",
  "calendar.bill.markPaid": "sync-backed",
  "calendar.bill.unmarkPaid": "sync-backed",
};

export function getMutationPolicy(kind: MutationCommand["kind"]): MutationPolicy {
  return MUTATION_POLICY[kind];
}

export type WriteThroughMutationModule = {
  commit: (command: MutationCommand) => Promise<MutationOutcome>;
  commitBatch: (commands: readonly MutationCommand[]) => Promise<readonly MutationOutcome[]>;
};

export type CommandEffectResult = {
  didMutate: boolean;
  effects: readonly MutationEffect[];
};

type TransactionCallback = Parameters<AnyDb["transaction"]>[0];
export type MutationDb = Parameters<TransactionCallback>[0];

export type MutationCommandApplier = (
  db: MutationDb,
  command: MutationCommand
) => CommandEffectResult;

export function toSyncEntry(
  tableName: SyncTableName,
  rowId: string,
  operation: SyncOperation,
  createdAt: IsoDateTime
) {
  return {
    id: generateSyncQueueId(),
    tableName,
    rowId,
    operation,
    createdAt,
  };
}

export function createBudgetCopyId(): BudgetId {
  return generateBudgetId();
}

function runEffects(effects: readonly MutationEffect[]): Promise<void> {
  return effects.reduce(async (previous, effect) => {
    await previous;
    await effect();
  }, Promise.resolve());
}

export function createGenericWriteThroughMutationModule(
  db: AnyDb,
  applyCommand: MutationCommandApplier
): WriteThroughMutationModule {
  return {
    commit: async (command) => {
      try {
        const result = db.transaction((tx) => applyCommand(tx, command));
        await runEffects(result.effects);
        return { success: true, didMutate: result.didMutate };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Mutation failed",
        };
      }
    },
    commitBatch: async (commands) => {
      try {
        const result = db.transaction((tx) =>
          commands.reduce<{
            outcomes: readonly MutationOutcome[];
            effects: readonly MutationEffect[];
          }>(
            (acc, command) => {
              const next = applyCommand(tx, command);
              return {
                outcomes: [...acc.outcomes, { success: true, didMutate: next.didMutate }],
                effects: [...acc.effects, ...next.effects],
              };
            },
            { outcomes: [], effects: [] }
          )
        );
        await runEffects(result.effects);
        return result.outcomes;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Mutation failed";
        return commands.map(() => ({ success: false, error: message }));
      }
    },
  };
}
