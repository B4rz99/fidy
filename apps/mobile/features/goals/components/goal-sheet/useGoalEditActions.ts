import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth";
import { Alert } from "@/shared/components/rn";
import { type AnyDb, tryGetDb } from "@/shared/db";
import { useAsyncGuard, useTranslation } from "@/shared/hooks";
import { toIsoDate } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type { Goal } from "../../schema";
import { deleteGoal, updateGoal } from "../../store";
import type { GoalSheetFormModel } from "./useGoalSheetForm";

type GoalMutationFields = {
  readonly amount: number;
  readonly goalType: Goal["type"];
  readonly interestRate: string;
  readonly name: string;
  readonly targetDate: Date | null;
};

type AsyncGuardRun = (fn: () => Promise<void>) => Promise<void>;

function parseGoalRate(interestRate: string) {
  const normalizedRate = interestRate.replace(",", ".");
  const parsedRate = /^\d+(\.\d+)?$/.test(normalizedRate)
    ? Number.parseFloat(normalizedRate)
    : null;

  return parsedRate != null && Number.isFinite(parsedRate) ? parsedRate : null;
}

function createGoalUpdateInput(goalId: string, form: GoalMutationFields) {
  return {
    id: goalId,
    data: {
      name: form.name.trim(),
      targetAmount: form.amount,
      targetDate: form.targetDate ? toIsoDate(form.targetDate) : null,
      interestRatePercent: form.goalType === "debt" ? parseGoalRate(form.interestRate) : null,
    },
  };
}

async function runGoalDelete(db: AnyDb, userId: UserId, back: () => void, goalId: string) {
  const success = await deleteGoal(db, userId, goalId);
  if (success) back();
}

async function runGoalSave(
  db: AnyDb,
  userId: UserId,
  back: () => void,
  goalId: string,
  form: GoalMutationFields
) {
  if (!form.name.trim() || form.amount <= 0) return;
  const success = await updateGoal(db, userId, createGoalUpdateInput(goalId, form));
  if (success) back();
}

function showDeleteConfirmation({
  back,
  goalName,
  goalId,
  guardedDelete,
  t,
  userId,
}: {
  readonly back: () => void;
  readonly goalName: Goal["name"];
  readonly goalId: string;
  readonly guardedDelete: AsyncGuardRun;
  readonly t: ReturnType<typeof useTranslation>["t"];
  readonly userId: UserId;
}) {
  Alert.alert(
    t("goals.edit.deleteConfirmTitle"),
    t("goals.edit.deleteConfirmMessage", { goalName }),
    [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          const db = tryGetDb(userId);
          if (!db) return;

          void guardedDelete(() => runGoalDelete(db, userId, back, goalId));
        },
      },
    ]
  );
}

export function useGoalEditActions(goal: Goal, goalId: string, form: GoalSheetFormModel) {
  const { back } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const { isBusy: isDeleting, run: guardedDelete } = useAsyncGuard();
  const fields = {
    amount: form.amount,
    goalType: form.goalType,
    interestRate: form.interestRate,
    name: form.name,
    targetDate: form.targetDate,
  } satisfies GoalMutationFields;

  return {
    isDeleting,
    isSaving,
    onDelete: useCallback(() => {
      if (!userId) return;
      showDeleteConfirmation({ back, goalId, goalName: goal.name, guardedDelete, t, userId });
    }, [back, goal.name, goalId, guardedDelete, t, userId]),
    onSave: useCallback(() => {
      if (!userId) return;
      const db = tryGetDb(userId);
      if (!db) return;

      void guardedSave(() => runGoalSave(db, userId, back, goalId, fields));
    }, [back, fields, goalId, guardedSave, userId]),
    userId,
  };
}
