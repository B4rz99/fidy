export type WeeklyDigestBudgetStatus = "on_track" | "over" | "no_budgets";

export type WeeklyDigestData = {
  readonly totalSpent: number;
  readonly topCategories: readonly {
    readonly name: string;
    readonly amount: number;
  }[];
  readonly budgetStatus: WeeklyDigestBudgetStatus;
  readonly goalContributionsThisWeek: number;
};

export type WeeklyDigestMessage = {
  readonly title: string;
  readonly body: string;
};

type TranslateDigest = (key: string, params?: Record<string, string | number>) => string;

export type LocalDigestTransaction = {
  readonly type: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly date: string;
};

export type LocalDigestBudget = {
  readonly amount: number;
  readonly categoryId: string;
  readonly month: string;
};

export type LocalDigestGoalContribution = {
  readonly amount: number;
  readonly date: string;
};

type LocalWeeklyDigestInput = {
  readonly sinceDate: string;
  readonly month: string;
  readonly transactions: readonly LocalDigestTransaction[];
  readonly budgets: readonly LocalDigestBudget[];
  readonly goalContributions: readonly LocalDigestGoalContribution[];
};

type CategoryTotal = {
  readonly categoryId: string;
  readonly name: string;
  readonly amount: number;
};

const MAX_DIGEST_BODY_LENGTH = 200;

const expenseTransactionsSince = (
  transactions: readonly LocalDigestTransaction[],
  sinceDate: string
): readonly LocalDigestTransaction[] =>
  transactions.filter(
    (transaction) => transaction.type === "expense" && transaction.date >= sinceDate
  );

const addCategoryTotal = (
  totals: readonly CategoryTotal[],
  transaction: LocalDigestTransaction
): readonly CategoryTotal[] => {
  const existingTotal = totals.find((total) => total.categoryId === transaction.categoryId);

  if (!existingTotal) {
    return [
      ...totals,
      {
        categoryId: transaction.categoryId,
        name: transaction.categoryName,
        amount: transaction.amount,
      },
    ];
  }

  return totals.map((total) =>
    total.categoryId === transaction.categoryId
      ? { ...total, amount: total.amount + transaction.amount }
      : total
  );
};

const deriveCategoryTotals = (
  transactions: readonly LocalDigestTransaction[]
): readonly CategoryTotal[] =>
  transactions.reduce(addCategoryTotal, [] as readonly CategoryTotal[]);

const deriveBudgetStatus = (
  budgets: readonly LocalDigestBudget[],
  categoryTotals: readonly CategoryTotal[],
  month: string
): WeeklyDigestBudgetStatus => {
  const monthlyBudgets = budgets.filter((budget) => budget.month === month);
  if (monthlyBudgets.length === 0) return "no_budgets";

  const isOverBudget = monthlyBudgets.some((budget) => {
    const categoryTotal = categoryTotals.find((total) => total.categoryId === budget.categoryId);
    return (categoryTotal?.amount ?? 0) > budget.amount;
  });

  return isOverBudget ? "over" : "on_track";
};

export function deriveLocalWeeklyDigestData(input: LocalWeeklyDigestInput): WeeklyDigestData {
  const expenses = expenseTransactionsSince(input.transactions, input.sinceDate);
  const categoryTotals = deriveCategoryTotals(expenses);

  return {
    totalSpent: expenses.reduce((sum, transaction) => sum + transaction.amount, 0),
    topCategories: [...categoryTotals]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 2)
      .map(({ name, amount }) => ({ name, amount })),
    budgetStatus: deriveBudgetStatus(input.budgets, categoryTotals, input.month),
    goalContributionsThisWeek: input.goalContributions
      .filter((contribution) => contribution.date >= input.sinceDate)
      .reduce((sum, contribution) => sum + contribution.amount, 0),
  };
}

const truncatePushBody = (body: string): string =>
  body.length > MAX_DIGEST_BODY_LENGTH ? `${body.slice(0, MAX_DIGEST_BODY_LENGTH - 3)}...` : body;

const CATEGORY_SEGMENT_KEYS = [
  null,
  "notifications.weeklyDigest.categoryOne",
  "notifications.weeklyDigest.categoryTwo",
] as const;
const EMPTY_TOP_CATEGORY = { name: "", amount: 0 } as const;

const getCategorySegmentKey = (
  categories: WeeklyDigestData["topCategories"]
): (typeof CATEGORY_SEGMENT_KEYS)[number] =>
  CATEGORY_SEGMENT_KEYS[Math.min(categories.length, 2)] ?? null;

const getCategorySegmentParams = (
  categories: WeeklyDigestData["topCategories"]
): Record<string, string> => {
  const [firstCategory = EMPTY_TOP_CATEGORY, secondCategory = EMPTY_TOP_CATEGORY] = categories;

  return {
    firstCategory: firstCategory.name,
    secondCategory: secondCategory.name,
  };
};

const deriveCategorySegment = (
  t: TranslateDigest,
  categories: WeeklyDigestData["topCategories"]
): string => {
  const key = getCategorySegmentKey(categories);
  return key === null ? "" : t(key, getCategorySegmentParams(categories));
};

const deriveBudgetSegment = (
  t: TranslateDigest,
  status: WeeklyDigestData["budgetStatus"]
): string => {
  if (status === "over") return t("notifications.weeklyDigest.budgetOver");
  if (status === "on_track") return t("notifications.weeklyDigest.budgetOnTrack");
  return "";
};

const deriveGoalSegment = (
  t: TranslateDigest,
  amount: number,
  formatAmount: (amount: number) => string
): string =>
  amount > 0
    ? t("notifications.weeklyDigest.goalContribution", { amount: formatAmount(amount) })
    : "";

export function deriveWeeklyDigestMessage(
  data: WeeklyDigestData,
  t: TranslateDigest,
  formatAmount: (amount: number) => string
): WeeklyDigestMessage {
  const body = [
    t("notifications.weeklyDigest.spending", { amount: formatAmount(data.totalSpent) }),
    deriveCategorySegment(t, data.topCategories),
    deriveBudgetSegment(t, data.budgetStatus),
    deriveGoalSegment(t, data.goalContributionsThisWeek, formatAmount),
  ].join("");

  return {
    title: t("notifications.weeklyDigest.title"),
    body: truncatePushBody(body),
  };
}
