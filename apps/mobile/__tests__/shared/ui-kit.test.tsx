import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Callout } from "@/shared/components/Callout";
import { Chip } from "@/shared/components/Chip";
import { DatePickerDialog } from "@/shared/components/DatePickerDialog";
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

describe("shared UI kit", () => {
  it("exports the first-wave primitives from the shared components barrel", () => {
    const source = readFileSync(resolve(__dirname, "../../shared/components/index.ts"), "utf-8");

    expect(source).toContain('export { Button } from "./Button"');
    expect(source).toContain('export { Card } from "./Card"');
    expect(source).toContain('export { Row } from "./Row"');
    expect(source).toContain('export { Chip } from "./Chip"');
    expect(source).toContain('export { Callout } from "./Callout"');
    expect(source).toContain('export { EmptyState } from "./EmptyState"');
    expect(source).toContain('export { DatePickerControl } from "./DatePickerControl"');
    expect(source).toContain('export { DatePickerDialog } from "./DatePickerDialog"');
    expect(source).toContain('export { FieldButton } from "./FieldButton"');
    expect(source).toContain('export { FieldSurface } from "./FieldSurface"');
    expect(source).toContain('export { FilterPill } from "./FilterPill"');
    expect(source).toContain('export { FilterTextField } from "./FilterTextField"');
    expect(source).toContain('export { FormTextField } from "./FormTextField"');
    expect(source).toContain('export { SegmentedControl } from "./SegmentedControl"');
    expect(source).toContain('export { SelectableChipRow } from "./SelectableChipRow"');
    expect(source).toContain('export { SurfacePressable } from "./SurfacePressable"');
    expect(source).toContain('export { AddActionButton } from "./AddActionButton"');
    expect(source).toContain('export { IconActionButton } from "./IconActionButton"');
    expect(source).toContain('export { ListRowSurface } from "./ListRowSurface"');
    expect(source).toContain('export { ListDateHeader } from "./ListDateHeader"');
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

  it("keeps shared surface styling behind surface modules", () => {
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
      "SurfacePressable.tsx",
      "ListRowSurface.tsx",
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
      "<SolidSurface"
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

  it("keeps selected filter and active field state out of decorative borders", () => {
    const sharedDir = resolve(__dirname, "../../shared/components");
    const chipSource = readFileSync(resolve(sharedDir, "Chip.tsx"), "utf-8");
    const filterPillSource = readFileSync(resolve(sharedDir, "FilterPill.tsx"), "utf-8");
    const fieldButtonSource = readFileSync(resolve(sharedDir, "FieldButton.tsx"), "utf-8");
    const segmentedSource = readFileSync(resolve(sharedDir, "SegmentedControl.tsx"), "utf-8");
    const selectableChipRowSource = readFileSync(
      resolve(sharedDir, "SelectableChipRow.tsx"),
      "utf-8"
    );

    expect(chipSource).not.toContain("selectedBorderColor");
    expect(chipSource).not.toContain("borderColor={selected");
    expect(chipSource).toContain("dimmed");
    expect(filterPillSource).toContain('const accentGreen = useThemeColor("accentGreen")');
    expect(filterPillSource).toContain("selectedColor ?? accentGreen");
    expect(filterPillSource).not.toContain("borderColor={selected");
    expect(filterPillSource).toContain("dimmed");
    expect(fieldButtonSource).not.toContain("active ? accentGreen : undefined");
    expect(segmentedSource).not.toContain("SegmentedControlTone");
    expect(segmentedSource).not.toContain("getOptionTone");
    expect(segmentedSource).toContain("const opacity = option.disabled ? 0.5");
    expect(segmentedSource).toContain("style={[styles.optionShell, { opacity }]}");
    expect(segmentedSource).toContain("style={{ color: selected ? primary : secondary }}");
    expect(selectableChipRowSource).not.toContain("SelectableChipRowTone");
    expect(selectableChipRowSource).not.toContain("selectedTone");
    expect(selectableChipRowSource).toContain(
      "dimmed={value !== null && !selected && !option.disabled}"
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
    expect(moneyEntrySource).toContain("reserveHiddenNumpadSpace={reserveHiddenNumpadSpace}");
    expect(transactionFormSource).toContain("reserveHiddenNumpadSpace={false}");
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

    expect(foodButton.props.accessibilityRole).toBe("button");
    expect(foodButton.props.accessibilityState).toMatchObject({ selected: true });
    expect(rentButton.props.accessibilityState).toMatchObject({ selected: false });

    screen.press(rentButton);

    expect(selections).toEqual(["rent"]);
  });

  it("can expose mutually exclusive chip row options as radios", () => {
    const screen = renderFidy(
      <SelectableChipRow
        accessibilityLabel="Account type"
        accessibilityRole="radiogroup"
        optionAccessibilityRole="radio"
        options={[
          { label: "Cash", value: "cash" },
          { label: "Credit card", value: "credit_card" },
        ]}
        value="cash"
        onChange={() => undefined}
      />
    );

    const group = screen.getByA11yLabel("Account type");
    const cashOption = screen.getByA11yLabel("Cash");
    const creditOption = screen.getByA11yLabel("Credit card");

    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(cashOption.props.accessibilityRole).toBe("radio");
    expect(cashOption.props.accessibilityState).toMatchObject({ selected: true });
    expect(creditOption.props.accessibilityRole).toBe("radio");
    expect(creditOption.props.accessibilityState).toMatchObject({ selected: false });
  });

  it("keeps explicit date picker maximum dates when future dates are allowed", () => {
    const maximumDate = new Date("2026-01-15T00:00:00.000Z");
    const screen = renderFidy(
      <DatePickerDialog
        allowFuture
        date={new Date("2026-01-01T00:00:00.000Z")}
        maximumDate={maximumDate}
        onChange={() => undefined}
        onClose={() => undefined}
        visible
      />
    );
    const picker = screen.root.findAll((node) => node.props.maximumDate === maximumDate)[0];

    if (picker == null) {
      throw new Error("Date picker did not receive the explicit maximumDate");
    }

    expect(picker.props.maximumDate).toBe(maximumDate);
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
});
