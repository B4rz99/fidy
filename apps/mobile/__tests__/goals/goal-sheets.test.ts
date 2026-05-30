import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const createSheetSource = readSource("../../features/goals/components/GoalCreateSheet.tsx");
const createGoalRouteSource = readSource("../../app/create-goal.tsx");
const addPaymentRouteSource = readSource("../../app/add-payment.tsx");
const editGoalRouteSource = readSource("../../app/edit-goal.tsx");
const rootLayoutSource = readSource("../../app/_layout.tsx");
const goalsListSource = readSource("../../features/goals/components/GoalsListScreen.tsx");
const goalCardSource = readSource("../../features/goals/components/GoalCard.tsx");
const goalDetailSource = readSource("../../features/goals/components/GoalDetail.tsx");
const addPaymentSource = readSource("../../features/goals/components/AddPaymentSheet.tsx");
const editSheetSource = readSource("../../features/goals/components/GoalEditSheet.tsx");
const editLoadedSource = readSource(
  "../../features/goals/components/goal-sheet/GoalEditSheetLoaded.tsx"
);
const formSource = readSource("../../features/goals/components/goal-sheet/GoalSheetForm.tsx");
const frameSource = readSource("../../features/goals/components/goal-sheet/GoalSheetFrame.tsx");
const stylesSource = readSource("../../features/goals/components/goal-sheet/GoalSheet.styles.ts");
const typeToggleSource = readSource(
  "../../features/goals/components/goal-sheet/GoalTypeToggle.tsx"
);
const dateFieldSource = readSource("../../features/goals/components/goal-sheet/GoalDateField.tsx");
const formHookSource = readSource("../../features/goals/components/goal-sheet/useGoalSheetForm.ts");
const createActionsSource = readSource(
  "../../features/goals/components/goal-sheet/useGoalCreateActions.ts"
);
const editActionsSource = readSource(
  "../../features/goals/components/goal-sheet/useGoalEditActions.ts"
);

test("keeps the create-goal sheet wired to the shared form without projection copy", () => {
  expect(createSheetSource).toContain("<GoalSheetForm");
  expect(createSheetSource).not.toContain("GoalProjectionHint");
  expect(createActionsSource).toContain("createGoal(db, userId");
  expect(createActionsSource).toContain("type: form.goalType");
});

test("keeps the edit-goal sheet wired to the shared form and delete flow", () => {
  expect(editSheetSource).toContain("<GoalEditSheetLoaded");
  expect(editSheetSource).toContain("<AppAuroraBackground");
  expect(editLoadedSource).toContain("<GoalSheetForm");
  expect(editLoadedSource).toContain("fullScreen");
  expect(editActionsSource).toContain("Alert.alert");
  expect(editActionsSource).toContain("deleteGoal(db, userId, goalId)");
  expect(editActionsSource).toContain("updateGoal(db, userId");
});

test("keeps the shared goal-sheet cluster wired to the date picker and numpad flow", () => {
  expect(formSource).toContain("<GoalAmountField");
  expect(formSource).toContain("<GoalDateField");
  expect(dateFieldSource).toContain("TransactionDatePickerSheet");
  expect(dateFieldSource).not.toContain("@react-native-community/datetimepicker");
  expect(formSource).toContain("<GoalTypeToggle");
  expect(formHookSource).toContain("handleNumpadPress");
  expect(formHookSource).toContain("setShowDatePicker(true)");
  expect(formHookSource).toContain('setNumpadTarget("amount")');
});

test("goals proposal keeps the empty state and goal pulse cards wired", () => {
  expect(goalsListSource).toContain("<ScreenLayout");
  expect(goalsListSource).toContain(
    'import { Button, EmptyState, ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";'
  );
  expect(goalsListSource).toContain("<EmptyState");
  expect(goalsListSource).toContain("<Button");
  expect(goalsListSource).not.toContain("styles.emptyCard");
  expect(goalsListSource).toContain("ItemSeparatorComponent={GoalItemSeparator}");
  expect(goalsListSource).toContain("itemSeparator");
  expect(goalCardSource).toContain("goal.iconName");
  expect(goalCardSource).toContain("percentPill");
  expect(goalCardSource).toContain('t("goals.card.detail")');
  expect(goalCardSource).toContain("summaryArea");
  expect(goalCardSource).toContain("onPress={onAddPayment}");
  expect(goalCardSource).not.toContain("event.stopPropagation()");
});

test("goal creation and payment sheets use the proposal card surface", () => {
  expect(createSheetSource).toContain("<GoalSheetForm");
  expect(createSheetSource).toContain("fullScreen");
  expect(formSource).toContain("showGoalTypeToggle");
  expect(frameSource).toContain("fullScreenForm");
  expect(addPaymentSource).toContain("paymentCard");
  expect(addPaymentSource).toContain("<AppAuroraBackground");
  expect(addPaymentSource).not.toContain("styles.title");
  expect(addPaymentSource).toContain('t("goals.payment.amount")');
});

test("goal payment date opens the shared calendar picker instead of editing raw text", () => {
  expect(addPaymentSource).toContain("TransactionDatePickerSheet");
  expect(addPaymentSource).toContain("showDatePicker");
  expect(addPaymentSource).toContain("setShowDatePicker(true)");
  expect(addPaymentSource).toContain("setDate(toIsoDate(nextDate))");
  expect(addPaymentSource).not.toContain('placeholder="YYYY-MM-DD"');
});

test("create-goal opens as a full screen route, not a dialog", () => {
  expect(createGoalRouteSource).not.toContain("DialogRouteFrame");
  expect(createGoalRouteSource).toContain('headerBackTitle: ""');
  expect(createGoalRouteSource).toContain('headerTitle: t("goals.create.title")');
  const createGoalStart = rootLayoutSource.indexOf('name="create-goal"');
  const addPaymentStart = rootLayoutSource.indexOf('name="add-payment"');
  expect(createGoalStart).toBeGreaterThan(-1);
  expect(addPaymentStart).toBeGreaterThan(createGoalStart);
  const createGoalBlock = rootLayoutSource.slice(createGoalStart, addPaymentStart);
  expect(createGoalBlock).toContain("fullScreenHeaderOptions");
  expect(createGoalBlock).not.toContain("DIALOG_MODAL");
});

test("goal payment and edit open as full screen routes, not dialogs", () => {
  expect(addPaymentRouteSource).not.toContain("DialogRouteFrame");
  expect(addPaymentRouteSource).toContain('headerBackTitle: ""');
  expect(addPaymentRouteSource).toContain('headerTitle: t("goals.payment.title")');
  expect(editGoalRouteSource).not.toContain("DialogRouteFrame");
  expect(editGoalRouteSource).toContain('headerBackTitle: ""');
  expect(editGoalRouteSource).toContain('headerTitle: t("goals.edit.title")');
  const addPaymentStart = rootLayoutSource.indexOf('name="add-payment"');
  const editGoalStart = rootLayoutSource.indexOf('name="edit-goal"');
  const addTransactionStart = rootLayoutSource.indexOf('name="add-transaction"');
  expect(addPaymentStart).toBeGreaterThan(-1);
  expect(editGoalStart).toBeGreaterThan(addPaymentStart);
  expect(addTransactionStart).toBeGreaterThan(editGoalStart);
  const addPaymentBlock = rootLayoutSource.slice(addPaymentStart, editGoalStart);
  const editGoalBlock = rootLayoutSource.slice(editGoalStart, addTransactionStart);
  expect(addPaymentBlock).toContain("fullScreenHeaderOptions");
  expect(addPaymentBlock).not.toContain("DIALOG_MODAL");
  expect(editGoalBlock).toContain("fullScreenHeaderOptions");
  expect(editGoalBlock).not.toContain("DIALOG_MODAL");
});

test("create-goal full screen avoids nested card and uses debt red state", () => {
  expect(frameSource).toContain("fullScreen ? styles.fullScreenForm : styles.formCard");
  expect(frameSource).toContain("<AppAuroraBackground");
  expect(frameSource).toContain("<ScrollView");
  expect(frameSource).toContain('keyboardShouldPersistTaps="handled"');
  expect(frameSource).toContain("FidyNumpad compact={fullScreen}");
  expect(stylesSource).toContain('justifyContent: "space-between"');
  expect(typeToggleSource).toContain("<SegmentedControl");
  expect(typeToggleSource).toContain('type === "debt" ? "danger" : "success"');
});

test("goal detail hides inherited tab title from the back button", () => {
  expect(goalDetailSource).toContain('headerBackTitle: ""');
  expect(goalDetailSource).toContain('headerBackButtonDisplayMode: "minimal"');
  expect(goalDetailSource).toContain("headerTitle: goal.name");
  expect(goalDetailSource).toContain("headerRight: () =>");
  expect(goalDetailSource).not.toContain('Platform.OS === "ios"');
});
