import type { CopAmount } from "@/shared/types/branded";

export type GoalProgress = {
  readonly percentComplete: number;
  readonly remaining: number;
  readonly isComplete: boolean;
};

export type MonthlyTotal = {
  readonly month: string;
  readonly type: string;
  readonly total: number;
};

export type ConfidenceTier = "none" | "low" | "medium" | "high";

export type GoalProjection = {
  readonly projectedDate: Date | null;
  readonly monthsToGo: number | null;
  readonly confidence: ConfidenceTier;
  readonly netMonthlySavings: number;
};

export type DebtProjectionResult =
  | {
      readonly status: "ok";
      readonly monthsToGo: number;
      readonly projectedDate: Date;
    }
  | { readonly status: "complete"; readonly monthsToGo: 0 }
  | { readonly status: "payment_too_low" }
  | {
      readonly status: "zero_rate";
      readonly monthsToGo: number;
      readonly projectedDate: Date;
    };

export type Milestone = {
  readonly month: Date;
  readonly cumulativeTarget: number;
  readonly isCompleted: boolean;
};

export type InstallmentProgress = {
  readonly current: number;
  readonly total: number;
};

export type BudgetNudge = {
  readonly categoryId: string;
  readonly currentSpending: number;
  readonly suggestedReduction: number;
  readonly monthsSaved: number;
};

export type GoalAlert = {
  readonly goalId: string;
  readonly goalName: string;
  readonly shiftMonths: number;
};

export type GoalPaceGuidance =
  | { readonly type: "pace_ahead"; readonly amountAhead: CopAmount }
  | {
      readonly type: "pace_behind";
      readonly amountBehind: CopAmount;
      readonly reason: "no_contributions" | "below_pace";
    };

export type GoalCardStatus =
  | { readonly kind: "completed" }
  | { readonly kind: "pace_ahead"; readonly amount: CopAmount }
  | { readonly kind: "pace_behind"; readonly amount: CopAmount }
  | { readonly kind: "start_saving" }
  | { readonly kind: "almost_there" };
