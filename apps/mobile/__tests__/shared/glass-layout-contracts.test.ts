import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sharedDir = resolve(__dirname, "../../shared/components");

function readShared(file: string) {
  return readFileSync(resolve(sharedDir, file), "utf-8");
}

function readSource(path: string) {
  return readFileSync(resolve(__dirname, path), "utf-8");
}

describe("glass layout contracts", () => {
  it("keeps core layout native in chip and segmented primitives", () => {
    const chipSource = readShared("Chip.tsx");
    const segmentedSource = readShared("SegmentedControl.tsx");
    const filterPillSource = readShared("FilterPill.tsx");

    expect(chipSource).toContain("StyleSheet.create");
    expect(chipSource).toMatch(/surface:\s*\{[\s\S]*flexDirection:\s*"row"/);
    expect(chipSource).toMatch(/surface:\s*\{[\s\S]*minHeight:\s*32/);
    expect(chipSource).toMatch(/surface:\s*\{[\s\S]*paddingHorizontal:\s*12/);
    expect(chipSource).toContain('size = "default"');
    expect(chipSource).toContain("compactSurface");
    expect(chipSource).toContain("toneBorderColor[tone] ?? neutralBorderColor");
    expect(chipSource).not.toMatch(/className=\{`[^`]*(?:flex-row|h-\d|px-\d|gap-)/);

    expect(segmentedSource).toContain("StyleSheet.create");
    expect(segmentedSource).toMatch(/container:\s*\{[\s\S]*flexDirection:\s*"row"/);
    expect(segmentedSource).toMatch(/container:\s*\{[\s\S]*height:\s*40/);
    expect(segmentedSource).toMatch(/optionBase:\s*\{[\s\S]*flex:\s*1/);
    expect(segmentedSource).toContain("nativeGlass={false}");
    expect(segmentedSource).not.toMatch(/className=\{`[^`]*(?:flex-row|h-\d|px-\d|gap-)/);

    expect(filterPillSource).toContain("nativeGlass={false}");
  });

  it("keeps glass visual overrides explicit instead of passing them through style", () => {
    const glassSource = readShared("GlassSurface.tsx");
    const buttonSource = readShared("Button.tsx");
    const fieldButtonSource = readShared("FieldButton.tsx");
    const pickerOptionSource = readShared("PickerOptionRow.tsx");

    expect(glassSource).toContain("function getLayoutStyle");
    expect(glassSource).toContain("backgroundColor: _backgroundColor");
    expect(glassSource).toContain("borderColor: _borderColor");
    expect(glassSource).toContain("borderRadius: _borderRadius");
    expect(glassSource).toContain("borderWidth: _borderWidth");

    [buttonSource, fieldButtonSource, pickerOptionSource].forEach((source) => {
      expect(source).toContain("borderColor=");
      expect(source).not.toMatch(/style=\{\[[^\]]*\{\s*borderColor:/);
    });
  });

  it("keeps migrated chip callsites on native chipStyle/style sizing", () => {
    const selectableChipRowSource = readShared("SelectableChipRow.tsx");
    const filterChipItemSource = readSource("../../features/search/components/FilterChipItem.tsx");
    const dateFilterSource = readSource("../../features/search/components/DateFilter.tsx");
    const categoryFilterSource = readSource("../../features/search/components/CategoryFilter.tsx");
    const addBillSource = readSource(
      "../../features/calendar/components/add-bill/AddBillFormContent.tsx"
    );
    const transactionAccountSource = readSource(
      "../../features/transactions/components/transaction-form/TransactionAccountSection.tsx"
    );

    expect(selectableChipRowSource).toContain("chipStyle?: StyleProp<ViewStyle>");
    expect(selectableChipRowSource).toContain("style={chipStyle}");

    [
      filterChipItemSource,
      dateFilterSource,
      categoryFilterSource,
      addBillSource,
      transactionAccountSource,
    ].forEach((source) => {
      expect(source).not.toMatch(/chipClassName=|className="[^"]*(?:h-auto|h-8|size-11|px-)/);
    });

    expect(filterChipItemSource).toContain("paddingHorizontal: 16");
    expect(filterChipItemSource).not.toContain("marginRight");
    expect(dateFilterSource).toContain("paddingHorizontal: 8");
    expect(categoryFilterSource).toContain("width: 44");
    expect(addBillSource).toContain("chipStyle");
    expect(transactionAccountSource).toContain("chipStyle");
  });

  it("keeps field-heavy form sections out of native glass", () => {
    const formSectionSource = readShared("FormSection.tsx");

    expect(formSectionSource).toContain("nativeGlass={false}");
  });

  it("routes selected account kind color through glass visual props", () => {
    const accountKindSource = readSource(
      "../../features/financial-accounts/components/financial-account-form/FinancialAccountFormFields.tsx"
    );

    expect(accountKindSource).toContain("backgroundColor={isSelected ? accentGreen : undefined}");
    expect(accountKindSource).not.toMatch(/style=\{\[[\s\S]*backgroundColor:/);
  });

  it("keeps toast shadows on new architecture boxShadow with Android fallback", () => {
    const toastSource = readShared("AppToastHost.tsx");

    expect(toastSource).toContain("boxShadow");
    expect(toastSource).not.toContain("shadowColor");
    expect(toastSource).not.toContain("shadowOffset");
    expect(toastSource).not.toContain("shadowOpacity");
    expect(toastSource).not.toContain("shadowRadius");
    expect(toastSource).toContain("getAndroidToastShadowFallback()");
    expect(toastSource).toContain("{ [LEGACY_ANDROID_SHADOW_PROPERTY]: 8 }");
  });

  it("keeps shared transaction rows on glass surfaces", () => {
    const transactionRowSource = readShared("TransactionRow.tsx");
    const activityItemSource = readSource(
      "../../features/dashboard/components/home-screen/ActivityFeedItem.tsx"
    );

    expect(transactionRowSource).toContain("<GlassSurface");
    expect(transactionRowSource).toContain("styles.rowSurface");
    expect(activityItemSource).not.toContain("activityCard");
    expect(activityItemSource).not.toMatch(/rgba\(28,\s*28,\s*30/);
  });

  it("keeps compact form field sizing on the glass field container", () => {
    const formTextFieldSource = readShared("FormTextField.tsx");
    const autoSuggestSource = readSource("../../app/auto-suggest-budgets.tsx");
    const budgetSetupSource = readSource(
      "../../features/onboarding/components/BudgetSetupStep.tsx"
    );

    expect(formTextFieldSource).toMatch(/function getFieldContainerStyle/);
    expect(formTextFieldSource).toContain("minWidth: flattened.minWidth");
    expect(formTextFieldSource).toContain("width: flattened.width");

    [autoSuggestSource, budgetSetupSource].forEach((source) => {
      expect(source).toContain("styles.amountInput");
      expect(source).toContain("minWidth: 64");
      expect(source).not.toContain("suggestion.suggestedAmount)}");
    });
  });
});
