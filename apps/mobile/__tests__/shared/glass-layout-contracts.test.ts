import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sharedDir = resolve(__dirname, "../../shared/components");

function readShared(file: string) {
  return readFileSync(resolve(sharedDir, file), "utf-8");
}

function readSource(path: string) {
  return readFileSync(resolve(__dirname, path), "utf-8");
}

function readSources(dir: string): readonly { readonly path: string; readonly source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return readSources(path);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [{ path, source: readFileSync(path, "utf-8") }];
  });
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
    const surfaceStyleSource = readShared("surface-style.ts");
    const buttonSource = readShared("Button.tsx");
    const fieldButtonSource = readShared("FieldButton.tsx");
    const glassPressableSource = readShared("GlassPressable.tsx");
    const listRowSurfaceSource = readShared("ListRowSurface.tsx");

    expect(glassSource).toContain("getSurfaceLayoutStyle(style)");
    expect(surfaceStyleSource).toContain("function getSurfaceLayoutStyle");
    expect(surfaceStyleSource).toContain("type SurfaceLayoutViewStyle = Pick<");
    expect(surfaceStyleSource).toContain("export type SurfaceLayoutStyle");
    expect(glassPressableSource).toContain("surfaceLayoutStyle?: SurfaceLayoutStyle");
    expect(surfaceStyleSource).toContain("backgroundColor: _backgroundColor");
    expect(surfaceStyleSource).toContain("borderColor: _borderColor");
    expect(surfaceStyleSource).toContain("borderRadius: _borderRadius");
    expect(surfaceStyleSource).toContain("borderStyle: _borderStyle");
    expect(surfaceStyleSource).toContain("borderWidth: _borderWidth");

    [buttonSource, fieldButtonSource].forEach((source) => {
      expect(source).toContain("borderColor=");
      expect(source).not.toMatch(/style=\{\[[^\]]*\{\s*borderColor:/);
    });
    expect(listRowSurfaceSource).toContain("borderColor={selected ? selectedColor : undefined}");
    expect(listRowSurfaceSource).not.toMatch(/style=\{\[[^\]]*\{\s*borderColor:/);
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

  it("keeps account kind selection behind the shared chip row interface", () => {
    const accountKindSource = readSource(
      "../../features/financial-accounts/components/financial-account-form/FinancialAccountFormFields.tsx"
    );
    const accountSuggestionCreateSource = readSource(
      "../../features/account-suggestions/components/CreateSuggestedAccountScreen.tsx"
    );

    expect(accountKindSource).toContain("SelectableChipRow");
    expect(accountKindSource).toContain('selectedTone="primary"');
    expect(accountKindSource).not.toContain("GlassPressable");
    expect(accountSuggestionCreateSource).toContain("FinancialAccountKindPicker");
    expect(accountSuggestionCreateSource).not.toContain("GlassPressable");
  });

  it("keeps direct feature GlassPressable usage allowlisted", () => {
    const featureRoot = resolve(__dirname, "../../features");
    const directFeatureUsages = readSources(featureRoot)
      .filter(({ source }) => source.includes("GlassPressable"))
      .map(({ path }) => relative(resolve(__dirname, "../.."), path))
      .sort();

    expect(directFeatureUsages).toEqual([
      "features/auth/components/OAuthButton.tsx",
      "features/qa/components/qa-tools/QaToolsCardButton.tsx",
    ]);
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
    const listRowSurfaceSource = readShared("ListRowSurface.tsx");
    const activityItemSource = readSource(
      "../../features/dashboard/components/home-screen/ActivityFeedItem.tsx"
    );

    expect(transactionRowSource).toContain("<ListRowSurface");
    expect(listRowSurfaceSource).toContain("<GlassSurface");
    expect(transactionRowSource).toContain("styles.rowSurface");
    expect(activityItemSource).not.toContain("activityCard");
    expect(activityItemSource).not.toMatch(/rgba\(28,\s*28,\s*30/);
  });

  it("keeps compact form field sizing on the glass field container", () => {
    const formTextFieldSource = readShared("FormTextField.tsx");
    const budgetSuggestionRowSource = readSource(
      "../../features/budget/components/BudgetSuggestionRow.tsx"
    );
    const autoSuggestSource = readSource("../../app/auto-suggest-budgets.tsx");
    const budgetSetupSource = readSource(
      "../../features/onboarding/components/BudgetSetupStep.tsx"
    );

    expect(formTextFieldSource).toMatch(/function getFieldContainerStyle/);
    expect(formTextFieldSource).toContain("minWidth: flattened.minWidth");
    expect(formTextFieldSource).toContain("width: flattened.width");
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
