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

describe("surface layout contracts", () => {
  it("keeps core layout on shared surface primitives", () => {
    const chipSource = readShared("Chip.tsx");
    const segmentedSource = readShared("SegmentedControl.tsx");
    const filterPillSource = readShared("FilterPill.tsx");

    expect(chipSource).toContain("StyleSheet.create");
    expect(chipSource).toMatch(/surface:\s*\{[\s\S]*flexDirection:\s*"row"/);
    expect(chipSource).toMatch(/surface:\s*\{[\s\S]*minHeight:\s*32/);
    expect(chipSource).toMatch(/surface:\s*\{[\s\S]*paddingHorizontal:\s*12/);
    expect(chipSource).toContain('size = "default"');
    expect(chipSource).toContain("compactSurface");
    expect(chipSource).not.toContain("toneBorderColor");
    expect(chipSource).not.toMatch(/className=\{`[^`]*(?:flex-row|h-\d|px-\d|gap-)/);

    expect(segmentedSource).toContain("StyleSheet.create");
    expect(segmentedSource).toMatch(/groupedContainer:\s*\{[\s\S]*flexDirection:\s*"row"/);
    expect(segmentedSource).toMatch(/groupedContainer:\s*\{[\s\S]*height:\s*40/);
    expect(segmentedSource).toMatch(/optionShell:\s*\{[\s\S]*flex:\s*1/);
    expect(segmentedSource).not.toMatch(/className=\{`[^`]*(?:flex-row|h-\d|px-\d|gap-)/);

    expect(filterPillSource).toContain("<SurfacePressable");
  });

  it("keeps surface visual overrides explicit instead of passing them through style", () => {
    const surfaceSource = readShared("SolidSurface.tsx");
    const surfaceStyleSource = readShared("surface-style.ts");
    const buttonSource = readShared("Button.tsx");
    const fieldButtonSource = readShared("FieldButton.tsx");
    const surfacePressableSource = readShared("SurfacePressable.tsx");
    const listRowSurfaceSource = readShared("ListRowSurface.tsx");

    expect(surfaceSource).toContain("getSurfaceLayoutStyle(style)");
    expect(surfaceStyleSource).toContain("function getSurfaceLayoutStyle");
    expect(surfaceStyleSource).toContain("type SurfaceLayoutViewStyle = Pick<");
    expect(surfaceStyleSource).toContain("export type SurfaceLayoutStyle");
    expect(surfacePressableSource).toContain("surfaceLayoutStyle?: SurfaceLayoutStyle");
    expect(surfaceStyleSource).toContain("backgroundColor: _backgroundColor");
    expect(surfaceStyleSource).toContain("borderColor: _borderColor");
    expect(surfaceStyleSource).toContain("borderRadius: _borderRadius");
    expect(surfaceStyleSource).toContain("borderStyle: _borderStyle");
    expect(surfaceStyleSource).toContain("borderWidth: _borderWidth");

    expect(buttonSource).not.toContain("borderColor=");
    expect(surfaceSource).toContain("borderWidth: StyleSheet.hairlineWidth");
    expect(surfacePressableSource).not.toContain("borderWidth");
    expect(fieldButtonSource).not.toContain("borderColor={active");
    [buttonSource, fieldButtonSource].forEach((source) => {
      expect(source).not.toMatch(/style=\{\[[^\]]*\{\s*borderColor:/);
    });
    expect(listRowSurfaceSource).not.toContain("borderColor={selected");
    expect(listRowSurfaceSource).not.toMatch(/style=\{\[[^\]]*\{\s*borderColor:/);
  });

  it("keeps shared surface tokens solid instead of translucent", () => {
    const cardTokensSource = readShared("surface-tokens.ts");

    expect(cardTokensSource).toContain('backgroundColor: "#FFFFFF"');
    expect(cardTokensSource).toContain('backgroundColor: "#1C1C1E"');
    expect(cardTokensSource).not.toContain("tintColor");
    expect(cardTokensSource).not.toContain("rgba(");
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

  it("keeps field-heavy form sections on shared surface surfaces", () => {
    const formSectionSource = readShared("FormSection.tsx");

    expect(formSectionSource).toContain("<SolidSurface");
  });

  it("keeps selected account kind state out of surface background and border props", () => {
    const accountKindSource = readSource(
      "../../features/financial-accounts/components/financial-account-form/FinancialAccountFormFields.tsx"
    );

    expect(accountKindSource).not.toContain("backgroundColor={isSelected");
    expect(accountKindSource).not.toContain("borderColor={isSelected");
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

  it("keeps shared transaction rows on surface surfaces", () => {
    const transactionRowSource = readShared("TransactionRow.tsx");
    const listRowSurfaceSource = readShared("ListRowSurface.tsx");
    const activityItemSource = readSource(
      "../../features/dashboard/components/home-screen/ActivityFeedItem.tsx"
    );

    expect(transactionRowSource).toContain("<ListRowSurface");
    expect(listRowSurfaceSource).toContain("<SolidSurface");
    expect(transactionRowSource).toContain("styles.rowSurface");
    expect(activityItemSource).not.toContain("activityCard");
    expect(activityItemSource).not.toMatch(/rgba\(28,\s*28,\s*30/);
  });

  it("keeps compact form field sizing on the surface field container", () => {
    const formTextFieldSource = readShared("FormTextField.tsx");
    const textFieldStyleSource = readShared("text-field-style.ts");
    const budgetSuggestionRowSource = readSource(
      "../../features/budget/components/BudgetSuggestionRow.tsx"
    );
    const autoSuggestSource = readSource("../../app/auto-suggest-budgets.tsx");
    const budgetSetupSource = readSource(
      "../../features/onboarding/components/BudgetSetupStep.tsx"
    );

    expect(formTextFieldSource).toContain('from "./text-field-style"');
    expect(textFieldStyleSource).toMatch(/function getFieldContainerStyle/);
    expect(textFieldStyleSource).toContain("minWidth: flattened.minWidth");
    expect(textFieldStyleSource).toContain("width: flattened.width");
    expect(textFieldStyleSource).toMatch(/paddingVertical: flattened.paddingVertical/);
    expect(budgetSuggestionRowSource).toContain("styles.amountInput");
    expect(budgetSuggestionRowSource).toContain("minWidth: 64");
    expect(budgetSuggestionRowSource).toContain("<FormTextField");

    [autoSuggestSource, budgetSetupSource].forEach((source) => {
      expect(source).toContain("<BudgetSuggestionRow");
      expect(source).not.toContain("styles.amountInput");
      expect(source).not.toContain("minWidth: 64");
      expect(source).not.toContain("suggestion.suggestedAmount)}");
    });
  });
});
