import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Callout } from "@/shared/components/Callout";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { FieldButton } from "@/shared/components/FieldButton";
import { FieldSurface } from "@/shared/components/FieldSurface";
import { FilterPill } from "@/shared/components/FilterPill";
import { FormTextField } from "@/shared/components/FormTextField";
import { IconActionButton } from "@/shared/components/IconActionButton";
import { MetricCard } from "@/shared/components/MetricCard";
import { MoneyAmountDisplay } from "@/shared/components/MoneyAmountDisplay";
import { MonthNavigator } from "@/shared/components/MonthNavigator";
import { PickerDialog } from "@/shared/components/PickerDialog";
import { PickerOptionRow } from "@/shared/components/PickerOptionRow";
import { Row } from "@/shared/components/Row";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { SelectableChipRow } from "@/shared/components/SelectableChipRow";
import { TextActionButton } from "@/shared/components/TextActionButton";
import { Text } from "@/shared/components/rn";

function expectSharedComponentImport(source: string, componentName: string) {
  const importsFromBarrel = new RegExp(
    `import\\s*\\{[\\s\\S]*\\b${componentName}\\b[\\s\\S]*\\}\\s*from "@/shared/components"`
  ).test(source);
  const importsDirectPrimitive = source.includes(`from "@/shared/components/${componentName}"`);

  expect(importsFromBarrel || importsDirectPrimitive).toBe(true);
}

describe("shared UI kit", () => {
  it("exports the first-wave primitives from the shared components barrel", () => {
    const source = readFileSync(resolve(__dirname, "../../shared/components/index.ts"), "utf-8");

    expect(source).toContain('export { Button } from "./Button"');
    expect(source).toContain('export { Card } from "./Card"');
    expect(source).toContain('export { Row } from "./Row"');
    expect(source).toContain('export { Chip } from "./Chip"');
    expect(source).toContain('export { Callout } from "./Callout"');
    expect(source).toContain('export { EmptyState } from "./EmptyState"');
    expect(source).toContain('export { FieldButton } from "./FieldButton"');
    expect(source).toContain('export { FieldSurface } from "./FieldSurface"');
    expect(source).toContain('export { FilterPill } from "./FilterPill"');
    expect(source).toContain('export { FilterTextField } from "./FilterTextField"');
    expect(source).toContain('export { FormTextField } from "./FormTextField"');
    expect(source).toContain('export { SegmentedControl } from "./SegmentedControl"');
    expect(source).toContain('export { SelectableChipRow } from "./SelectableChipRow"');
    expect(source).toContain('export { IconActionButton } from "./IconActionButton"');
    expect(source).toContain('export { MonthNavigator } from "./MonthNavigator"');
    expect(source).toContain('export { MoneyAmountDisplay } from "./MoneyAmountDisplay"');
    expect(source).toContain('export { MoneyEntryAmountField } from "./MoneyEntryAmountField"');
    expect(source).toContain('export { MoneyEntryDateButton } from "./MoneyEntryDateButton"');
    expect(source).toContain('export { MoneyEntryScreen } from "./MoneyEntryScreen"');
    expect(source).toContain('export { MoneyEntryTextField } from "./MoneyEntryTextField"');
    expect(source).toContain('export { NumpadActionFooter } from "./NumpadActionFooter"');
    expect(source).toContain('export { NumpadFormScreen } from "./NumpadFormScreen"');
    expect(source).toContain('export { PickerOptionRow } from "./PickerOptionRow"');
    expect(source).toContain('export { PickerDialog } from "./PickerDialog"');
    expect(source).toContain('export { PinnedFormStack } from "./PinnedFormStack"');
    expect(source).toContain('export { ChoiceTray } from "./ChoiceTray"');
  });

  it("renders primitive text content", () => {
    const screen = renderFidy(
      <Row
        title="Theme"
        subtitle="System"
        leading={<Text>Icon</Text>}
        trailing={<Text>Trail</Text>}
      />
    );

    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByText("Icon")).toBeTruthy();
    expect(screen.getByText("Trail")).toBeTruthy();
  });

  it("renders chip, callout, empty state, and button copy", () => {
    const screen = renderFidy(
      <>
        <Chip label="Active" tone="primary" />
        <Callout title="Review needed" subtitle="Check this before saving" />
        <EmptyState title="No notifications" subtitle="You are all caught up" />
        <Button label="Continue" />
      </>
    );

    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Review needed")).toBeTruthy();
    expect(screen.getByText("Check this before saving")).toBeTruthy();
    expect(screen.getByText("No notifications")).toBeTruthy();
    expect(screen.getByText("You are all caught up")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it("renders interactive cards as accessible buttons", () => {
    const presses: string[] = [];
    const screen = renderFidy(
      <Card accessibilityLabel="Open card" onPress={() => presses.push("pressed")}>
        <Text>Interactive card</Text>
      </Card>
    );

    screen.pressByA11yLabel("Open card");

    expect(screen.getByText("Interactive card")).toBeTruthy();
    expect(presses).toEqual(["pressed"]);
  });

  it("renders field buttons, metric cards, and filter pills as reusable primitives", () => {
    const actions: string[] = [];
    const screen = renderFidy(
      <>
        <FieldButton
          label="Target date"
          value=""
          placeholder="Choose"
          clearAccessibilityLabel="Clear date"
          onPress={() => actions.push("field")}
          onClear={() => actions.push("clear")}
        />
        <MetricCard>
          <Text>Monthly spend</Text>
        </MetricCard>
        <FilterPill
          label="This month"
          accessibilityLabel="This month filter"
          selected
          onPress={() => actions.push("filter")}
        />
        <PickerOptionRow
          title="Savings"
          subtitle="Account"
          selected
          onPress={() => actions.push("picker")}
        />
        <PickerDialog visible={false} title="Choose" onClose={() => actions.push("picker-close")}>
          <Text>Picker content</Text>
        </PickerDialog>
        <FieldSurface>
          <Text>Field surface</Text>
        </FieldSurface>
        <FormTextField label="Name" value="" onChangeText={() => undefined} placeholder="Account" />
        <TextActionButton label="See all" onPress={() => actions.push("text-action")} />
      </>
    );

    screen.pressByA11yLabel("Clear date");
    screen.pressByA11yLabel("This month filter");
    screen.press(screen.getByText("See all"));

    expect(screen.getByText("Target date")).toBeTruthy();
    expect(screen.getByText("Choose")).toBeTruthy();
    expect(screen.getByText("Monthly spend")).toBeTruthy();
    expect(screen.getByText("Savings")).toBeTruthy();
    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("Field surface")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByA11yLabel("Name")).toBeTruthy();
    expect(actions).toEqual(["clear", "filter", "text-action"]);
  });

  it("keeps shared surface styling behind glass modules", () => {
    const sharedDir = resolve(__dirname, "../../shared/components");
    const sources = [
      "Card.tsx",
      "Button.tsx",
      "Chip.tsx",
      "DialogFrame.tsx",
      "FieldSurface.tsx",
      "FieldButton.tsx",
      "FilterPill.tsx",
      "FilterTextField.tsx",
      "FormTextField.tsx",
      "FormSection.tsx",
      "MoneyEntryFieldSurface.tsx",
      "PickerDialog.tsx",
      "PickerOptionRow.tsx",
      "SettingsSection.tsx",
    ].map((file) => [file, readFileSync(resolve(sharedDir, file), "utf-8")] as const);

    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(
        /\bbg-card\b|\bbg-card-dark\b|\bbg-surface\b|\bbg-surface-dark\b/
      );
      expect(source, file).not.toContain('useThemeColor("card")');
      expect(source, file).not.toContain('useThemeColor("peachLight")');
      expect(source, file).not.toMatch(/backgroundColor:\s*(card|peachLight)/);
    }

    expect(readFileSync(resolve(sharedDir, "FieldSurface.tsx"), "utf-8")).toContain(
      "<GlassSurface"
    );
    expect(readFileSync(resolve(sharedDir, "FormTextField.tsx"), "utf-8")).toContain(
      "<FieldSurface"
    );
    expect(readFileSync(resolve(sharedDir, "FieldButton.tsx"), "utf-8")).toContain("<FieldSurface");
    expect(readFileSync(resolve(sharedDir, "FilterTextField.tsx"), "utf-8")).toContain(
      "<FieldSurface"
    );
    expect(readFileSync(resolve(sharedDir, "PickerDialog.tsx"), "utf-8")).toContain("<DialogFrame");
    expect(readFileSync(resolve(sharedDir, "Button.tsx"), "utf-8")).not.toMatch(
      /\bbg-action-primary\b|\bbg-danger\b|\bbg-page\b|\bbg-peach-btn\b/
    );
    expect(readFileSync(resolve(sharedDir, "Chip.tsx"), "utf-8")).not.toMatch(
      /\bbg-action-primary\b|\bbg-danger\b|\bbg-success\b|\bbg-warning\b/
    );
  });

  it("keeps numpad entry screens behind the money entry module", () => {
    const sharedDir = resolve(__dirname, "../../shared/components");
    const moneyEntrySource = readFileSync(resolve(sharedDir, "MoneyEntryScreen.tsx"), "utf-8");
    const createBudgetSource = readFileSync(
      resolve(
        __dirname,
        "../../features/budget/components/create-budget/CreateBudgetFormContent.tsx"
      ),
      "utf-8"
    );
    const addPaymentSource = readFileSync(
      resolve(__dirname, "../../features/goals/components/AddPaymentScreen.tsx"),
      "utf-8"
    );
    const goalFrameSource = readFileSync(
      resolve(__dirname, "../../features/goals/components/goal-form/GoalFormFrame.tsx"),
      "utf-8"
    );
    const transactionFormSource = readFileSync(
      resolve(
        __dirname,
        "../../features/transactions/components/transaction-form/TransactionFormContent.tsx"
      ),
      "utf-8"
    );

    expect(moneyEntrySource).toContain("<NumpadFormScreen");
    for (const source of [
      createBudgetSource,
      addPaymentSource,
      goalFrameSource,
      transactionFormSource,
    ]) {
      expect(source).toContain("MoneyEntryScreen");
      expect(source).not.toContain("NumpadFormScreen");
    }
  });

  it("renders money amount display with formatted digits and empty fallback", () => {
    const screen = renderFidy(
      <>
        <MoneyAmountDisplay color="#111111" digits="125000" />
        <MoneyAmountDisplay color="#111111" digits="" />
      </>
    );

    expect(screen.getByText("$125.000")).toBeTruthy();
    expect(screen.getByText("$")).toBeTruthy();
  });

  it("selects segmented control options through accessible buttons", () => {
    const selections: string[] = [];
    const screen = renderFidy(
      <SegmentedControl
        accessibilityLabel="Report period"
        options={[
          { label: "Week", value: "week", accessibilityLabel: "Week period" },
          { label: "Month", value: "month", accessibilityLabel: "Month period" },
        ]}
        value="week"
        onChange={(value) => selections.push(value)}
      />
    );

    const weekButton = screen.getByA11yLabel("Week period");
    const monthButton = screen.getByA11yLabel("Month period");

    expect(weekButton.props.accessibilityState).toMatchObject({ selected: true });
    expect(monthButton.props.accessibilityState).toMatchObject({ selected: false });

    screen.press(monthButton);

    expect(selections).toEqual(["month"]);
  });

  it("can reselect the active segmented control option when enabled", () => {
    const selections: string[] = [];
    const screen = renderFidy(
      <SegmentedControl
        options={[{ label: "Expense", value: "expense", accessibilityLabel: "Expense type" }]}
        value="expense"
        onChange={(value) => selections.push(value)}
        allowReselect
      />
    );

    screen.pressByA11yLabel("Expense type");

    expect(selections).toEqual(["expense"]);
  });

  it("forwards field button accessibility props to the pressable", () => {
    const screen = renderFidy(
      <FieldButton
        label="From"
        value="Cash"
        onPress={() => undefined}
        testID="from-side"
        accessibilityLabel="Select from side"
        accessibilityHint="Choose transfer source"
      />
    );
    const button = screen.getByA11yLabel("Select from side");

    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityHint).toBe("Choose transfer source");
    expect(button.props.testID).toBe("from-side");
  });

  it("selects chip row options through accessible buttons", () => {
    const selections: string[] = [];
    const screen = renderFidy(
      <SelectableChipRow
        accessibilityLabel="Category"
        options={[
          { label: "Food", value: "food" },
          { label: "Rent", value: "rent" },
        ]}
        value="food"
        onChange={(value) => selections.push(value)}
      />
    );

    const foodButton = screen.getByA11yLabel("Food");
    const rentButton = screen.getByA11yLabel("Rent");

    expect(foodButton.props.accessibilityState).toMatchObject({ selected: true });
    expect(rentButton.props.accessibilityState).toMatchObject({ selected: false });

    screen.press(rentButton);

    expect(selections).toEqual(["rent"]);
  });

  it("renders icon action buttons with optional badges", () => {
    const presses: string[] = [];
    const screen = renderFidy(
      <IconActionButton
        accessibilityLabel="Open notifications"
        badgeLabel="3"
        icon={<Text>Bell</Text>}
        onPress={() => presses.push("pressed")}
      />
    );

    screen.pressByA11yLabel("Open notifications");

    expect(screen.getByText("Bell")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(presses).toEqual(["pressed"]);
  });

  it("navigates months through previous and next buttons", () => {
    const presses: string[] = [];
    const screen = renderFidy(
      <MonthNavigator
        label="May 2026"
        previousAccessibilityLabel="Previous month"
        nextAccessibilityLabel="Next month"
        onPrevious={() => presses.push("previous")}
        onNext={() => presses.push("next")}
      />
    );

    expect(screen.getByText("May 2026")).toBeTruthy();

    screen.pressByA11yLabel("Previous month");
    screen.pressByA11yLabel("Next month");

    expect(presses).toEqual(["previous", "next"]);
  });

  it("defaults interactive chip and callout roles to button", () => {
    const chip = renderFidy(
      <Chip
        label="Interactive chip"
        accessibilityLabel="Interactive chip"
        onPress={() => undefined}
      />
    );
    const callout = renderFidy(
      <Callout
        title="Interactive callout"
        accessibilityLabel="Interactive callout"
        onPress={() => undefined}
      />
    );

    const chipButtons = chip.root.findAll((node) => node.props.accessibilityRole === "button");
    const calloutButtons = callout.root.findAll(
      (node) => node.props.accessibilityRole === "button"
    );

    expect(chipButtons).toHaveLength(1);
    expect(calloutButtons).toHaveLength(1);
  });

  it("renders dismissible callouts with an accessible dismiss action", () => {
    const dismisses: string[] = [];
    const presses: string[] = [];
    const screen = renderFidy(
      <Callout
        title="Dismissible callout"
        dismissAccessibilityLabel="Dismiss callout"
        trailing={<Text>Details</Text>}
        onPress={() => presses.push("pressed")}
        onDismiss={() => dismisses.push("dismissed")}
      />
    );

    screen.pressByA11yLabel("Dismiss callout");

    expect(screen.getByText("Dismissible callout")).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
    expect(dismisses).toEqual(["dismissed"]);
    expect(presses).toEqual([]);
  });

  it("keeps simple review and capture banners on the shared Callout primitive", () => {
    const files = [
      "../../features/dashboard/components/NeedsReviewBanner.tsx",
      "../../features/dashboard/components/AttributionReviewBanner.tsx",
      "../../features/capture-sources/components/DetectedTransactionsBanner.tsx",
      "../../features/budget/components/BudgetAlertBanner.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "Callout");
      expect(source).toContain("<Callout");
      expect(source).not.toContain("<Pressable");
      expect(source).not.toContain("StyleSheet.create");
    });
  });

  it("keeps SettingsRow as a wrapper around the shared Row primitive", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/settings/components/SettingsRow.tsx"),
      "utf-8"
    );

    expect(source).toContain('import { Row } from "@/shared/components"');
    expect(source).toContain("<Row");
    expect(source).not.toContain("StyleSheet");
  });

  it("keeps migrated empty states and callouts on shared primitives", () => {
    const notificationEmptyStateSource = readFileSync(
      resolve(__dirname, "../../features/notifications/components/NotificationEmptyState.tsx"),
      "utf-8"
    );
    const accountPromptSource = readFileSync(
      resolve(
        __dirname,
        "../../features/account-suggestions/components/AccountSuggestionsPromptBanner.tsx"
      ),
      "utf-8"
    );

    expect(notificationEmptyStateSource).toContain(
      'import { EmptyState } from "@/shared/components"'
    );
    expect(notificationEmptyStateSource).toContain("<EmptyState");
    expect(notificationEmptyStateSource).not.toContain("StyleSheet");
    expect(accountPromptSource).toContain('import { Callout } from "@/shared/components"');
    expect(accountPromptSource).toContain("<Callout");
    expect(accountPromptSource).not.toContain("StyleSheet");
  });
  it("keeps review queue helpers composed from shared primitives", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/review-queues/components/shared.tsx"),
      "utf-8"
    );

    expect(source).toContain("Button");
    expect(source).toContain("Callout");
    expect(source).toContain("SharedEmptyState");
    expect(source).toContain("Row");
    expect(source).not.toContain("StyleSheet");
    expect(source).not.toContain("Pressable");
  });
  it("keeps account suggestion cards composed from shared primitives", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/account-suggestions/components/AccountSuggestionCard.tsx"),
      "utf-8"
    );

    expect(source).toContain('import { Button, Card, Chip } from "@/shared/components"');
    expect(source).toContain("<Button");
    expect(source).toContain("<Card");
    expect(source).toContain("<Chip");
    expect(source).not.toContain("StyleSheet");
    expect(source).not.toContain("Pressable");
  });

  it("keeps simple visual card containers on the shared Card primitive", () => {
    const files = [
      "../../app/connected-accounts.tsx",
      "../../features/capture-sources/components/NotificationSetupCard.tsx",
      "../../features/capture-sources/components/ApplePaySetupCard.tsx",
      "../../features/email-capture/components/EmailConnectBanner.tsx",
      "../../features/settings/components/BackupStatusCard.tsx",
      "../../features/settings/components/PrivateBackupChecklist.tsx",
      "../../features/settings/components/PrivateBackupScreen.tsx",
      "../../features/qa/components/LocalQaProfileTools.tsx",
      "../../features/ai-chat/components/ActionCard.tsx",
      "../../features/ai-chat/components/ConversationList.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "Card");
      expect(source).toContain("<Card");
      expect(source).not.toContain("rounded-chart bg-card");
      expect(source).not.toContain("rounded-2xl bg-card");
      expect(source).not.toContain('className="bg-card dark:bg-card-dark"');
    });
  });

  it("keeps migrated entity cards on shared card primitives", () => {
    const files = [
      "../../features/budget/components/BudgetCard.tsx",
      "../../features/goals/components/GoalCard.tsx",
      "../../features/notifications/components/NotificationCard.tsx",
      "../../features/review-queues/components/AttributionQueueCard.tsx",
      "../../features/review-queues/components/FinancialMeaningQueueScreen.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expect(source).toMatch(/<(?:Card|MetricCard)(?:\s|>)/);
      expect(source).not.toContain("<Card className=");
      expect(source).not.toContain("<MetricCard className=");
      expect(source).not.toContain("styles.card,");
      expect(source).not.toMatch(/<Pressable\s*\n\s*onPress=/);
    });
  });

  it("keeps migrated metric cards on the shared MetricCard primitive", () => {
    const files = [
      "../../features/budget/components/BudgetSummaryCard.tsx",
      "../../features/dashboard/components/home-screen/HomeSpendingCard.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "MetricCard");
      expect(source).toContain("<MetricCard");
      expect(source).not.toContain("<MetricCard className=");
      expect(source).not.toContain("styles.card");
    });
  });

  it("keeps migrated form field buttons on the shared FieldButton primitive", () => {
    const files = [
      "../../features/transfers/components/transfer-form/TransferSideCard.tsx",
      "../../features/financial-accounts/components/financial-account-form/FinancialAccountFormBody.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "FieldButton");
      expect(source).toContain("<FieldButton");
    });
  });

  it("keeps money-entry date controls on the shared money entry date button", () => {
    const files = [
      "../../features/goals/components/AddPaymentScreen.tsx",
      "../../features/goals/components/goal-form/GoalDateField.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "MoneyEntryDateButton");
      expect(source).toContain("<MoneyEntryDateButton");
    });
  });

  it("keeps money-entry amount controls on the shared money entry amount field", () => {
    const files = [
      "../../features/budget/components/create-budget/CreateBudgetFormContent.tsx",
      "../../features/goals/components/AddPaymentScreen.tsx",
      "../../features/goals/components/goal-form/GoalAmountField.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "MoneyEntryAmountField");
      expect(source).toContain("<MoneyEntryAmountField");
    });
  });

  it("keeps repeated form text inputs on the shared FormTextField primitive", () => {
    const files = [
      "../../app/auto-suggest-budgets.tsx",
      "../../features/account-suggestions/components/CreateSuggestedAccountScreen.tsx",
      "../../features/calendar/components/add-bill/AddBillFormContent.tsx",
      "../../features/categories/components/category-form/CreateCategoryScreenContent.tsx",
      "../../features/financial-accounts/components/FinancialAccountIdentifierScreen.tsx",
      "../../features/financial-accounts/components/financial-account-form/FinancialAccountFormBody.tsx",
      "../../features/financial-accounts/components/financial-account-form/FinancialAccountIdentifiersSection.tsx",
      "../../features/onboarding/components/BudgetSetupStep.tsx",
      "../../features/settings/components/PrivateBackupScreen.tsx",
      "../../features/transactions/components/transaction-form/TransactionMetadataRow.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "FormTextField");
      expect(source).toContain("<FormTextField");
      expect(source).not.toContain("<FieldLabel");
      expect(source).not.toContain("<TextInput");
    });
  });

  it("keeps money-entry text inputs on the shared money entry text field", () => {
    const files = [
      "../../features/goals/components/AddPaymentScreen.tsx",
      "../../features/goals/components/goal-form/GoalInterestField.tsx",
      "../../features/goals/components/goal-form/GoalNameField.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "MoneyEntryTextField");
      expect(source).toContain("<MoneyEntryTextField");
      expect(source).not.toContain("<TextInput");
    });
  });

  it("keeps migrated search filters on shared filter primitives", () => {
    const dateFilterSource = readFileSync(
      resolve(__dirname, "../../features/search/components/DateFilter.tsx"),
      "utf-8"
    );
    const amountFilterSource = readFileSync(
      resolve(__dirname, "../../features/search/components/AmountFilter.tsx"),
      "utf-8"
    );
    const typeFilterSource = readFileSync(
      resolve(__dirname, "../../features/search/components/TypeFilter.tsx"),
      "utf-8"
    );
    const categoryFilterSource = readFileSync(
      resolve(__dirname, "../../features/search/components/CategoryFilter.tsx"),
      "utf-8"
    );

    expect(dateFilterSource).toContain("FieldButton");
    expect(dateFilterSource).toContain("FilterPill");
    expect(amountFilterSource).toContain("FilterTextField");
    expect(typeFilterSource).toContain("SegmentedControl");
    expect(categoryFilterSource).toContain("SharedFilterPill");
  });

  it("keeps AI conversation cards horizontal through explicit Card contentStyle", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/ai-chat/components/ConversationList.tsx"),
      "utf-8"
    );

    expect(source).toContain("contentStyle");
    expect(source).toMatch(/flexDirection:\s*['"]row['"]/);
    expect(source).not.toContain('className="rounded-lg"');
  });

  it("keeps inline text and icon actions on shared action primitives", () => {
    const upcomingBillsSource = readFileSync(
      resolve(__dirname, "../../features/budget/components/UpcomingBillsSection.tsx"),
      "utf-8"
    );
    const notificationsSource = readFileSync(
      resolve(__dirname, "../../features/notifications/components/NotificationsScreen.tsx"),
      "utf-8"
    );
    const goalsListSource = readFileSync(
      resolve(__dirname, "../../features/goals/components/GoalsListScreen.tsx"),
      "utf-8"
    );

    expectSharedComponentImport(upcomingBillsSource, "TextActionButton");
    expectSharedComponentImport(notificationsSource, "TextActionButton");
    expectSharedComponentImport(goalsListSource, "IconActionButton");
    expect(upcomingBillsSource).toContain("<TextActionButton");
    expect(notificationsSource).toContain("<TextActionButton");
    expect(goalsListSource).toContain("<IconActionButton");
  });

  it("keeps simple local action buttons on the shared Button primitive", () => {
    const files = [
      "../../app/connected-accounts.tsx",
      "../../features/email-capture/components/EmailConnectBanner.tsx",
      "../../features/ai-chat/components/ActionCard.tsx",
      "../../features/settings/components/PrivateBackupActionButton.tsx",
      "../../features/qa/components/LocalQaProfileTools.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "Button");
      expect(source).toContain("<Button");
      expect(source).not.toContain("<Pressable");
    });

    const profileSource = readFileSync(
      resolve(__dirname, "../../features/settings/components/ProfileScreen.tsx"),
      "utf-8"
    );

    expectSharedComponentImport(profileSource, "Button");
    expect(profileSource).toContain("<Button");
    expect(profileSource).not.toContain("bg-card dark:bg-card-dark rounded-2xl w-full");
  });

  it("keeps simple picker option rows on the shared Row primitive", () => {
    const files = ["../../app/language-picker.tsx", "../../app/theme-picker.tsx"];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "Row");
      expect(source).toContain("<Row");
      expect(source).not.toContain("<Pressable");
      expect(source).not.toContain("StyleSheet.hairlineWidth");
      expect(source).not.toContain("borderBottomWidth");
    });
  });

  it("keeps search filter chips on the shared Chip primitive", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/search/components/FilterChipRow.tsx"),
      "utf-8"
    );

    expect(source).toContain('import { Chip } from "@/shared/components"');
    expect(source).toContain("<Chip");
    expect(source).not.toContain("Pressable");
  });

  it("keeps repeated feed screens on the shared FeedList primitive", () => {
    const files = [
      "../../features/budget/components/BudgetListScreen.tsx",
      "../../features/goals/components/GoalsListScreen.tsx",
      "../../features/ai-chat/components/ConversationList.tsx",
      "../../features/search/components/search-screen/SearchResultsList.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "FeedList");
      expect(source).toContain("<FeedList");
    });
  });

  it("keeps remaining list empty states and CTAs on shared primitives", () => {
    const budgetListSource = readFileSync(
      resolve(__dirname, "../../features/budget/components/BudgetListScreen.tsx"),
      "utf-8"
    );
    const goalsListSource = readFileSync(
      resolve(__dirname, "../../features/goals/components/GoalsListScreen.tsx"),
      "utf-8"
    );
    const financialAccountsSource = readFileSync(
      resolve(
        __dirname,
        "../../features/financial-accounts/components/financial-accounts-screen/FinancialAccountsScreenContent.tsx"
      ),
      "utf-8"
    );
    const accountSuggestionsSource = readFileSync(
      resolve(
        __dirname,
        "../../features/account-suggestions/components/AccountSuggestionReviewScreen.tsx"
      ),
      "utf-8"
    );

    expect(budgetListSource).toContain("<EmptyState");
    expect(budgetListSource).toContain("<Button");
    expect(budgetListSource).not.toContain("styles.emptyTitle");
    expect(goalsListSource).toContain("<EmptyState");
    expect(goalsListSource).toContain("<Button");
    expect(goalsListSource).not.toContain("styles.emptyCard");
    expect(financialAccountsSource).toContain("<EmptyState");
    expect(financialAccountsSource).not.toContain("styles.emptyTitle");
    expect(accountSuggestionsSource).toContain("<EmptyState");
    expect(accountSuggestionsSource).not.toContain("styles.emptyTitle");
  });

  it("keeps secondary empty states and simple CTAs on shared primitives", () => {
    const createSuggestedAccountSource = readFileSync(
      resolve(
        __dirname,
        "../../features/account-suggestions/components/CreateSuggestedAccountScreen.tsx"
      ),
      "utf-8"
    );
    const linkSuggestedAccountSource = readFileSync(
      resolve(
        __dirname,
        "../../features/account-suggestions/components/LinkSuggestedAccountScreen.tsx"
      ),
      "utf-8"
    );
    const searchEmptyStateSource = readFileSync(
      resolve(__dirname, "../../features/search/components/SearchEmptyState.tsx"),
      "utf-8"
    );
    const analyticsScreenSource = readFileSync(
      resolve(__dirname, "../../features/analytics/components/AnalyticsScreen.tsx"),
      "utf-8"
    );

    expect(createSuggestedAccountSource).toContain("<EmptyState");
    expect(createSuggestedAccountSource).toContain("<Button");
    expect(createSuggestedAccountSource).not.toContain("styles.emptyTitle");
    expect(createSuggestedAccountSource).not.toContain("styles.saveButton");
    expect(linkSuggestedAccountSource).toContain("<EmptyState");
    expect(linkSuggestedAccountSource).not.toContain("styles.emptyTitle");
    expect(searchEmptyStateSource).toContain("<EmptyState");
    expect(searchEmptyStateSource).toContain("<Button");
    expect(searchEmptyStateSource).not.toContain("Pressable");
    expect(analyticsScreenSource).toContain("<EmptyState");
    expect(analyticsScreenSource).not.toContain("styles.emptyText");
  });

  it("keeps account detail and goal detail CTAs on shared primitives", () => {
    const financialAccountDetailSource = readFileSync(
      resolve(
        __dirname,
        "../../features/financial-accounts/components/financial-account-details-screen/FinancialAccountDetailsScreenContent.tsx"
      ),
      "utf-8"
    );
    const goalContributionsSource = readFileSync(
      resolve(
        __dirname,
        "../../features/goals/components/goal-detail/GoalDetailContributionsTab.tsx"
      ),
      "utf-8"
    );
    const goalAiPlanSource = readFileSync(
      resolve(__dirname, "../../features/goals/components/goal-detail/GoalDetailAiPlanTab.tsx"),
      "utf-8"
    );

    expect(financialAccountDetailSource).toContain("<EmptyState");
    expect(financialAccountDetailSource).toContain("<Callout");
    expect(financialAccountDetailSource).toContain("<Button");
    expect(financialAccountDetailSource).not.toContain("styles.primaryButton");
    expect(goalContributionsSource).toContain("<Button");
    expect(goalContributionsSource).not.toContain("styles.ctaButton");
    expect(goalAiPlanSource).toContain("<Button");
    expect(goalAiPlanSource).not.toContain("styles.ctaButton");
  });

  it("keeps onboarding primary CTAs on the shared Button primitive", () => {
    const welcomeStepSource = readFileSync(
      resolve(__dirname, "../../features/onboarding/components/WelcomeStep.tsx"),
      "utf-8"
    );
    const budgetSetupStepSource = readFileSync(
      resolve(__dirname, "../../features/onboarding/components/BudgetSetupStep.tsx"),
      "utf-8"
    );
    const syncProgressStepSource = readFileSync(
      resolve(__dirname, "../../features/onboarding/components/SyncProgressStep.tsx"),
      "utf-8"
    );
    const completeStepSource = readFileSync(
      resolve(__dirname, "../../features/onboarding/components/CompleteStep.tsx"),
      "utf-8"
    );

    expect(welcomeStepSource).toContain('import { Button, FidyLogo } from "@/shared/components"');
    expect(welcomeStepSource).toContain("<Button");
    expect(welcomeStepSource).not.toContain("styles.primaryButton");
    expectSharedComponentImport(budgetSetupStepSource, "Button");
    expect(budgetSetupStepSource).toContain("<Button");
    expect(budgetSetupStepSource).not.toContain("styles.primaryButton");
    expect(syncProgressStepSource).toContain('import { Button } from "@/shared/components"');
    expect(syncProgressStepSource).toContain("<Button");
    expect(syncProgressStepSource).not.toContain("styles.primaryButton");
    expect(completeStepSource).toContain('import { Button } from "@/shared/components"');
    expect(completeStepSource).toContain("<Button");
    expect(completeStepSource).not.toContain("styles.primaryButton");
  });

  it("keeps category list rows, empty state, and add action on shared primitives", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/categories/components/CategoriesScreen.tsx"),
      "utf-8"
    );

    expectSharedComponentImport(source, "Button");
    expectSharedComponentImport(source, "EmptyState");
    expectSharedComponentImport(source, "Row");
    expect(source).toContain("<Button");
    expect(source).toContain("<EmptyState");
    expect(source).toContain("<Row");
    expect(source).not.toContain("<Pressable");
    expect(source).not.toContain("styles.emptyText");
    expect(source).not.toContain("styles.categoryRow");
    expect(source).not.toContain("styles.addButton");
  });

  it("keeps remaining repeated action buttons on the shared Button primitive", () => {
    const goalSheetActionSource = readFileSync(
      resolve(__dirname, "../../features/goals/components/goal-form/GoalFormActionButton.tsx"),
      "utf-8"
    );
    const financialAccountIdentifierSource = readFileSync(
      resolve(
        __dirname,
        "../../features/financial-accounts/components/FinancialAccountIdentifierScreen.tsx"
      ),
      "utf-8"
    );
    const transactionActionSource = readFileSync(
      resolve(
        __dirname,
        "../../features/transactions/components/transaction-form/TransactionActionSection.tsx"
      ),
      "utf-8"
    );

    expect(goalSheetActionSource).toContain('import { Button } from "@/shared/components"');
    expect(goalSheetActionSource).toContain("<Button");
    expect(goalSheetActionSource).not.toContain("<Pressable");
    expect(goalSheetActionSource).not.toContain("styles.actionButton");
    expectSharedComponentImport(financialAccountIdentifierSource, "Button");
    expectSharedComponentImport(financialAccountIdentifierSource, "ScreenLayout");
    expect(financialAccountIdentifierSource).toContain("<Button");
    expect(financialAccountIdentifierSource).not.toContain("styles.primaryButton");
    expect(transactionActionSource).toContain("NumpadActionFooter");
    expect(transactionActionSource).not.toContain("<Pressable");
    expect(transactionActionSource).not.toContain("styles.saveButton");
    expect(transactionActionSource).not.toContain("styles.deleteButton");
    expect(transactionActionSource).not.toContain("styles.extraActionButton");
  });

  it("keeps remaining save and CTA buttons on the shared Button primitive", () => {
    const files = [
      "../../features/budget/components/create-budget/CreateBudgetFormContent.tsx",
      "../../features/calendar/components/add-bill/AddBillFormContent.tsx",
      "../../features/goals/components/AddPaymentScreen.tsx",
      "../../features/goals/components/GoalCard.tsx",
      "../../features/financial-accounts/components/FinancialAccountFormScreen.tsx",
      "../../features/financial-accounts/components/financial-account-form/FinancialAccountFormBody.tsx",
      "../../features/transfers/components/transfer-form/TransferFormContent.tsx",
      "../../features/qa/components/qa-tools/QaToolsContent.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "Button");
      expect(source).toContain("<Button");
      expect(source).not.toContain("styles.primaryButton");
      expect(source).not.toContain("styles.saveButton");
      expect(source).not.toContain("styles.ctaButton");
    });
  });

  it("keeps remaining simple empty states on the shared EmptyState primitive", () => {
    const files = [
      "../../features/budget/components/UpcomingBillsSection.tsx",
      "../../features/onboarding/components/BudgetSetupStep.tsx",
      "../../features/goals/components/goal-detail/GoalDetailContributionsTab.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expectSharedComponentImport(source, "EmptyState");
      expect(source).toContain("<EmptyState");
      expect(source).not.toContain("styles.emptyText");
    });
  });
  it("keeps repeated selectors on shared selection primitives", () => {
    const files = [
      "../../features/analytics/components/PeriodSelector.tsx",
      "../../features/transactions/components/TypeToggle.tsx",
      "../../features/goals/components/goal-form/GoalTypeToggle.tsx",
      "../../features/goals/components/goal-detail/TabControl.tsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(__dirname, file), "utf-8");

      expect(source).toContain("SegmentedControl");
      expect(source).not.toContain("<Pressable");
    });
  });

  it("keeps migrated chip rows and month navigators on shared primitives", () => {
    const addBillSource = readFileSync(
      resolve(__dirname, "../../features/calendar/components/add-bill/AddBillFormContent.tsx"),
      "utf-8"
    );
    const transactionAccountSource = readFileSync(
      resolve(
        __dirname,
        "../../features/transactions/components/transaction-form/TransactionAccountSection.tsx"
      ),
      "utf-8"
    );
    const budgetMonthSource = readFileSync(
      resolve(__dirname, "../../features/budget/components/BudgetHeaderMonthNavigator.tsx"),
      "utf-8"
    );
    const calendarMonthSource = readFileSync(
      resolve(__dirname, "../../features/calendar/components/MonthNavigator.tsx"),
      "utf-8"
    );

    expect(addBillSource).toContain("SelectableChipRow");
    expect(transactionAccountSource).toContain("SelectableChipRow");
    expect(transactionAccountSource).not.toContain("<Pressable");
    expect(budgetMonthSource).toContain("MonthNavigator");
    expect(budgetMonthSource).not.toContain("StyleSheet");
    expect(calendarMonthSource).toContain("SharedMonthNavigator");
    expect(calendarMonthSource).not.toContain("StyleSheet");
  });
});
