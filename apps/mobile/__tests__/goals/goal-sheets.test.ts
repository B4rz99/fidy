import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { expectRouteInRootStackGroup } from "@/__tests__/helpers/root-stack-routes";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

let createSheetSource = "";
let createGoalRouteSource = "";
let addPaymentRouteSource = "";
let editGoalRouteSource = "";
let rootLayoutSource = "";
let rootStackRoutesSource = "";
let goalsListSource = "";
let goalCardSource = "";
let goalDetailSource = "";
let addPaymentSource = "";
let editSheetSource = "";
let editLoadedSource = "";
let formSource = "";
let frameSource = "";
let stylesSource = "";
let numpadFormScreenSource = "";
let typeToggleSource = "";
let dateFieldSource = "";
let formHookSource = "";
let createActionsSource = "";
let editActionsSource = "";

beforeAll(() => {
  createSheetSource = readSource("../../features/goals/components/GoalCreateScreen.tsx");
  createGoalRouteSource = readSource("../../app/create-goal.tsx");
  addPaymentRouteSource = readSource("../../app/add-payment.tsx");
  editGoalRouteSource = readSource("../../app/edit-goal.tsx");
  rootLayoutSource = readSource("../../app/_layout.tsx");
  rootStackRoutesSource = readSource("../../shared/navigation/root-stack-routes.ts");
  goalsListSource = readSource("../../features/goals/components/GoalsListScreen.tsx");
  goalCardSource = readSource("../../features/goals/components/GoalCard.tsx");
  goalDetailSource = readSource("../../features/goals/components/GoalDetail.tsx");
  addPaymentSource = readSource("../../features/goals/components/AddPaymentScreen.tsx");
  editSheetSource = readSource("../../features/goals/components/GoalEditScreen.tsx");
  editLoadedSource = readSource(
    "../../features/goals/components/goal-form/GoalEditScreenLoaded.tsx"
  );
  formSource = readSource("../../features/goals/components/goal-form/GoalForm.tsx");
  frameSource = readSource("../../features/goals/components/goal-form/GoalFormFrame.tsx");
  stylesSource = readSource("../../features/goals/components/goal-form/GoalForm.styles.ts");
  numpadFormScreenSource = readSource("../../shared/components/NumpadFormScreen.tsx");
  typeToggleSource = readSource("../../features/goals/components/goal-form/GoalTypeToggle.tsx");
  dateFieldSource = readSource("../../features/goals/components/goal-form/GoalDateField.tsx");
  formHookSource = readSource("../../features/goals/components/goal-form/useGoalForm.ts");
  createActionsSource = readSource(
    "../../features/goals/components/goal-form/useGoalCreateActions.ts"
  );
  editActionsSource = readSource("../../features/goals/components/goal-form/useGoalEditActions.ts");
});

test("keeps the create-goal sheet wired to the shared form without projection copy", () => {
  expect(createSheetSource).toContain("<GoalForm");
  expect(createSheetSource).not.toContain("GoalProjectionHint");
  expect(createActionsSource).toContain("createGoal(db, userId");
  expect(createActionsSource).toContain("type: form.goalType");
});

test("keeps the edit-goal sheet wired to the shared form and delete flow", () => {
  expect(editSheetSource).toContain("<GoalEditScreenLoaded");
  expect(editSheetSource).toContain("<AppAuroraBackground");
  expect(editLoadedSource).toContain("<GoalForm");
  expect(editLoadedSource).not.toContain("fullScreen");
  expect(editActionsSource).toContain("Alert.alert");
  expect(editActionsSource).toContain("deleteGoal(db, userId, goalId)");
  expect(editActionsSource).toContain("updateGoal(db, userId");
});

test("keeps the shared goal-form cluster wired to the date picker and numpad flow", () => {
  expect(formSource).toContain("<GoalAmountField");
  expect(formSource).toContain("<GoalDateField");
  expect(dateFieldSource).toContain("TransactionDatePickerDialog");
  expect(dateFieldSource).not.toContain("@react-native-community/datetimepicker");
  expect(formSource).toContain("<GoalTypeToggle");
  expect(formHookSource).toContain("handleNumpadPress");
  expect(formHookSource).toContain("setShowDatePicker(true)");
  expect(formHookSource).toContain('setNumpadTarget("amount")');
});

test("goals proposal keeps the empty state and goal cards wired", () => {
  expect(goalsListSource).toContain("<ScreenLayout");
  expect(goalsListSource).toContain("Button");
  expect(goalsListSource).toContain("EmptyState");
  expect(goalsListSource).toContain("ScreenLayout");
  expect(goalsListSource).toContain("TAB_BAR_CLEARANCE");
  expect(goalsListSource).toContain("<EmptyState");
  expect(goalsListSource).toContain("<Button");
  expect(goalsListSource).not.toContain("styles.emptyCard");
  expect(goalsListSource).toContain("<FeedList");
  expect(goalsListSource).toContain("itemSeparatorHeight={12}");
  expect(goalCardSource).toContain("goal.iconName");
  expect(goalCardSource).toContain("percentPill");
  expect(goalCardSource).toContain('t("goals.card.detail")');
  expect(goalCardSource).toContain("summaryArea");
  expect(goalCardSource).toContain("onPress={onAddPayment}");
  expect(goalCardSource).not.toContain("event.stopPropagation()");
});

test("goal creation and payment sheets use the shared numpad form surface", () => {
  expect(createSheetSource).toContain("<GoalForm");
  expect(createSheetSource).not.toContain("fullScreen");
  expect(formSource).toContain("showGoalTypeToggle");
  expect(formSource).not.toContain("hideLabel");
  expect(formSource).not.toContain('size={fullScreen ? "hero" : "medium"}');
  expect(frameSource).not.toContain("fullScreen ? styles.fullScreenForm : styles.formCard");
  expect(frameSource).toContain("<MoneyEntryScreen");
  expect(addPaymentSource).toContain("<MoneyEntryScreen");
  expect(addPaymentSource).toContain("actionContent={");
  expect(addPaymentSource).toContain("amountContent={");
  expect(addPaymentSource).not.toContain("<Card");
  expect(addPaymentSource).not.toContain("<AppAuroraBackground");
  expect(addPaymentSource).not.toContain("styles.title");
  expect(addPaymentSource).toContain('accessibilityLabel={t("goals.payment.amount")}');
});

test("goal payment date opens the shared calendar picker instead of editing raw text", () => {
  expect(addPaymentSource).toContain("TransactionDatePickerDialog");
  expect(addPaymentSource).toContain("showDatePicker");
  expect(addPaymentSource).toContain("setShowDatePicker(true)");
  expect(addPaymentSource).toContain("toLocaleDateString(locale)");
  expect(addPaymentSource).toContain("value={dateLabel}");
  expect(addPaymentSource).toContain("setDate(toIsoDate(nextDate))");
  expect(addPaymentSource).not.toContain('placeholder="YYYY-MM-DD"');
});

test("create-goal opens as a full screen route, not a dialog", () => {
  expect(createGoalRouteSource).not.toContain("DialogRouteFrame");
  expect(createGoalRouteSource).toContain('headerBackTitle: ""');
  expect(createGoalRouteSource).toContain('headerTitle: t("goals.create.title")');
  expect(rootLayoutSource).toContain("ROOT_STACK_ROUTES.fullScreen");
  expect(rootLayoutSource).toContain("ROOT_STACK_ROUTES.fullScreen.map");
  expect(rootLayoutSource).toContain("routeOptions.fullScreen");
  expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "create-goal");
});

test("goal payment and edit open as full screen routes, not dialogs", () => {
  expect(addPaymentRouteSource).not.toContain("DialogRouteFrame");
  expect(addPaymentRouteSource).toContain('headerBackTitle: ""');
  expect(addPaymentRouteSource).toContain('headerTitle: t("goals.payment.title")');
  expect(editGoalRouteSource).not.toContain("DialogRouteFrame");
  expect(editGoalRouteSource).toContain('headerBackTitle: ""');
  expect(editGoalRouteSource).toContain('headerTitle: t("goals.edit.title")');
  expect(rootLayoutSource).toContain("ROOT_STACK_ROUTES.fullScreen");
  expect(rootLayoutSource).toContain("ROOT_STACK_ROUTES.fullScreen.map");
  expect(rootLayoutSource).toContain("routeOptions.fullScreen");
  expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "add-payment");
  expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "edit-goal");
});

test("create-goal full screen avoids nested card and uses debt red state", () => {
  expect(frameSource).not.toContain("formCard");
  expect(frameSource).not.toContain("<ScrollView");
  expect(frameSource).not.toContain("<FidyNumpad");
  expect(frameSource).toContain("<MoneyEntryScreen");
  expect(frameSource).toContain("numpadVisible={numpadEnabled}");
  expect(numpadFormScreenSource).toContain("<AppAuroraBackground");
  expect(numpadFormScreenSource).toContain("<FidyNumpad");
  expect(numpadFormScreenSource).toContain("<ScrollView");
  expect(numpadFormScreenSource).toContain("accessible={false}");
  expect(numpadFormScreenSource).toContain("Math.max(bottom, 16)");
  expect(numpadFormScreenSource).toContain('justifyContent: "center"');
  expect(numpadFormScreenSource).toContain("bottomShell");
  expect(stylesSource).toMatch(/fullScreenContainer:\s*\{\s*gap:\s*16,\s*paddingBottom:\s*12,/);
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
