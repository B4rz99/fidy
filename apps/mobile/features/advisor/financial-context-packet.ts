import type { AnyDb } from "@/shared/db/client";
import { requireMonth } from "@/shared/types/assertions";
import type { Month, UserId } from "@/shared/types/branded";

export type FinancialContextCategoryTotal = {
  readonly categoryId: string;
  readonly total: number;
};

export type FinancialContextCategoryDelta = {
  readonly categoryId: string;
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
};

export type FinancialContextPacket = {
  readonly summary: {
    readonly balance: number;
    readonly currentMonthSpending: readonly FinancialContextCategoryTotal[];
    readonly previousMonthSpending: readonly FinancialContextCategoryTotal[];
    readonly monthOverMonthDeltas: readonly FinancialContextCategoryDelta[];
  };
  readonly recentTransactions: readonly {
    readonly type: string;
    readonly amount: number;
    readonly categoryId: string;
    readonly description: string;
    readonly date: string;
  }[];
  readonly budgets: readonly {
    readonly categoryId: string;
    readonly amount: number;
    readonly month: Month;
  }[];
  readonly goals: readonly {
    readonly name: string;
    readonly type: string;
    readonly targetAmount: number;
    readonly currentAmount: number;
    readonly progressPct: number;
  }[];
  readonly accounts: readonly {
    readonly name: string;
    readonly kind: string;
    readonly isDefault: boolean;
  }[];
  readonly captureEvidence: readonly {
    readonly scope: string;
    readonly value: string;
    readonly sourceFamily: string;
    readonly evidenceType: string;
    readonly occurrences: number;
  }[];
};

export type BuildFinancialContextPacketInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly now?: Date;
};

export type FinancialContextPacketPorts = {
  readonly getBalance: (db: AnyDb, userId: UserId) => number;
  readonly getSpendingByCategory: (
    db: AnyDb,
    userId: UserId,
    month: Month
  ) => readonly FinancialContextCategoryTotal[];
  readonly getRecentTransactions: (
    input: BuildFinancialContextPacketInput & {
      readonly currentMonth: Month;
      readonly previousMonth: Month;
    }
  ) => FinancialContextPacket["recentTransactions"];
  readonly getBudgetsForMonth: (
    db: AnyDb,
    userId: UserId,
    month: Month
  ) => FinancialContextPacket["budgets"];
  readonly getGoals: (
    db: AnyDb,
    userId: UserId
  ) => readonly {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly targetAmount: number;
  }[];
  readonly getGoalCurrentAmount: (db: AnyDb, goalId: string) => number;
  readonly getAccounts: (db: AnyDb, userId: UserId) => FinancialContextPacket["accounts"];
  readonly getCaptureEvidence: (
    db: AnyDb,
    userId: UserId
  ) => FinancialContextPacket["captureEvidence"];
};

const toContextMonth = (date: Date): Month =>
  requireMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);

const previousContextMonth = (month: Month): Month => {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const previousMonth = monthNumber === 1 ? 12 : monthNumber - 1;
  const previousYear = monthNumber === 1 ? year - 1 : year;
  return requireMonth(`${previousYear}-${String(previousMonth).padStart(2, "0")}`);
};

const deriveFinancialContextDeltas = (
  current: readonly FinancialContextCategoryTotal[],
  previous: readonly FinancialContextCategoryTotal[]
): readonly FinancialContextCategoryDelta[] => {
  const currentByCategory = new Map(current.map((item) => [item.categoryId, item.total]));
  const previousByCategory = new Map(previous.map((item) => [item.categoryId, item.total]));
  return [
    ...new Set([
      ...current.map((item) => item.categoryId),
      ...previous.map((item) => item.categoryId),
    ]),
  ].map((categoryId) =>
    toCategoryDelta(
      categoryId,
      currentByCategory.get(categoryId) ?? 0,
      previousByCategory.get(categoryId) ?? 0
    )
  );
};

const toCategoryDelta = (
  categoryId: string,
  current: number,
  previous: number
): FinancialContextCategoryDelta => ({
  categoryId,
  current,
  previous,
  delta: current - previous,
});

export function createFinancialContextPacketBuilder(ports: FinancialContextPacketPorts) {
  return (input: BuildFinancialContextPacketInput): FinancialContextPacket => {
    const currentMonth = toContextMonth(input.now ?? new Date());
    const previousMonth = previousContextMonth(currentMonth);
    const currentMonthSpending = ports.getSpendingByCategory(input.db, input.userId, currentMonth);
    const previousMonthSpending = ports.getSpendingByCategory(
      input.db,
      input.userId,
      previousMonth
    );
    const goals = ports.getGoals(input.db, input.userId).map((goal) => {
      const currentAmount = ports.getGoalCurrentAmount(input.db, goal.id);
      return {
        name: goal.name,
        type: goal.type,
        targetAmount: goal.targetAmount,
        currentAmount,
        progressPct:
          goal.targetAmount > 0 ? Math.round((currentAmount / goal.targetAmount) * 100) : 0,
      };
    });

    return {
      summary: {
        balance: ports.getBalance(input.db, input.userId),
        currentMonthSpending,
        previousMonthSpending,
        monthOverMonthDeltas: deriveFinancialContextDeltas(
          currentMonthSpending,
          previousMonthSpending
        ),
      },
      recentTransactions: ports.getRecentTransactions({ ...input, currentMonth, previousMonth }),
      budgets: ports.getBudgetsForMonth(input.db, input.userId, currentMonth),
      goals,
      accounts: ports.getAccounts(input.db, input.userId),
      captureEvidence: ports.getCaptureEvidence(input.db, input.userId),
    };
  };
}
