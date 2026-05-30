import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import type { AnyDb } from "@/shared/db/client";
import { tryGetDb } from "@/shared/db/client";
import { useAsyncGuard } from "@/shared/hooks";
import { toIsoDate } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type { GoalType } from "../../schema";
import { createGoal, useGoalStore } from "../../store";
import type { GoalSheetFormModel } from "./useGoalSheetForm";

function getEstimatedMonths(netMonthlySavings: number, amount: number) {
  return netMonthlySavings > 0 && amount > 0 ? Math.ceil(amount / netMonthlySavings) : null;
}

type GoalMutationFields = {
  readonly amount: number;
  readonly goalType: GoalType;
  readonly interestRate: string;
  readonly name: string;
  readonly targetDate: Date | null;
};

function parseGoalRate(interestRate: string) {
  const normalizedRate = interestRate.replace(",", ".");
  const parsedRate = /^\d+(\.\d+)?$/.test(normalizedRate)
    ? Number.parseFloat(normalizedRate)
    : null;

  return parsedRate != null && Number.isFinite(parsedRate) ? parsedRate : null;
}

function createGoalInput(form: GoalMutationFields) {
  return {
    name: form.name.trim(),
    type: form.goalType,
    targetAmount: form.amount,
    targetDate: form.targetDate ? toIsoDate(form.targetDate) : undefined,
    interestRatePercent:
      form.goalType === "debt" ? (parseGoalRate(form.interestRate) ?? undefined) : undefined,
  };
}

async function runGoalCreate(
  db: AnyDb,
  userId: UserId,
  back: () => void,
  form: GoalMutationFields
) {
  if (!form.name.trim() || form.amount <= 0) return;
  const success = await createGoal(db, userId, createGoalInput(form));
  if (success) back();
}

export function useGoalCreateActions(form: GoalSheetFormModel) {
  const { back } = useRouter();
  const goals = useGoalStore((state) => state.goals);
  const userId = useOptionalUserId();
  const { isBusy: isCreating, run: guardedCreate } = useAsyncGuard();
  const netMonthlySavings = goals[0]?.projection.netMonthlySavings ?? 0;
  const fields = useMemo(
    () =>
      ({
        amount: form.amount,
        goalType: form.goalType,
        interestRate: form.interestRate,
        name: form.name,
        targetDate: form.targetDate,
      }) satisfies GoalMutationFields,
    [form.amount, form.goalType, form.interestRate, form.name, form.targetDate]
  );

  return {
    estimatedMonths: getEstimatedMonths(netMonthlySavings, fields.amount),
    isCreating,
    onCreate: useCallback(() => {
      if (!userId) return;
      const db = tryGetDb(userId);
      if (!db) return;

      void guardedCreate(() => runGoalCreate(db, userId, back, fields));
    }, [back, fields, guardedCreate, userId]),
    userId,
  };
}
