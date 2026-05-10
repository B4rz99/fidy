import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const createSheetSource = readSource("../../features/goals/components/GoalCreateSheet.tsx");
const editSheetSource = readSource("../../features/goals/components/GoalEditSheet.tsx");
const editLoadedSource = readSource(
  "../../features/goals/components/goal-sheet/GoalEditSheetLoaded.tsx"
);
const formSource = readSource("../../features/goals/components/goal-sheet/GoalSheetForm.tsx");
const dateFieldSource = readSource("../../features/goals/components/goal-sheet/GoalDateField.tsx");
const formHookSource = readSource("../../features/goals/components/goal-sheet/useGoalSheetForm.ts");
const createActionsSource = readSource(
  "../../features/goals/components/goal-sheet/useGoalCreateActions.ts"
);
const editActionsSource = readSource(
  "../../features/goals/components/goal-sheet/useGoalEditActions.ts"
);

test("keeps the create-goal sheet wired to the shared form and projection hint", () => {
  expect(createSheetSource).toContain("<GoalSheetForm");
  expect(createSheetSource).toContain("<GoalProjectionHint");
  expect(createActionsSource).toContain("createGoal(db, userId");
  expect(createActionsSource).toContain("type: form.goalType");
});

test("keeps the edit-goal sheet wired to the shared form and delete flow", () => {
  expect(editSheetSource).toContain("<GoalEditSheetLoaded");
  expect(editLoadedSource).toContain("<GoalSheetForm");
  expect(editActionsSource).toContain("Alert.alert");
  expect(editActionsSource).toContain("deleteGoal(db, userId, goalId)");
  expect(editActionsSource).toContain("updateGoal(db, userId");
});

test("keeps the shared goal-sheet cluster wired to the date picker and numpad flow", () => {
  expect(formSource).toContain("<GoalAmountField");
  expect(formSource).toContain("<GoalDateField");
  expect(dateFieldSource).toContain('@expo/ui/community/datetime-picker');
  expect(formSource).toContain("<GoalTypeToggle");
  expect(formHookSource).toContain("handleNumpadPress");
  expect(formHookSource).toContain("setShowDatePicker(true)");
  expect(formHookSource).toContain('setNumpadTarget("amount")');
});
