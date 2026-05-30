import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { Button } from "@/shared/components/Button";
import { Callout } from "@/shared/components/Callout";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { Row } from "@/shared/components/Row";
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

  it("keeps search filter chips on the shared Chip primitive", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/search/components/FilterChipRow.tsx"),
      "utf-8"
    );

    expect(source).toContain('import { Chip } from "@/shared/components"');
    expect(source).toContain("<Chip");
    expect(source).not.toContain("Pressable");
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
      resolve(__dirname, "../../features/goals/components/goal-sheet/GoalSheetActionButton.tsx"),
      "utf-8"
    );
    const financialAccountIdentifierSource = readFileSync(
      resolve(
        __dirname,
        "../../features/financial-accounts/components/FinancialAccountIdentifierSheet.tsx"
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
    expect(financialAccountIdentifierSource).toContain(
      'import { Button, ScreenLayout } from "@/shared/components"'
    );
    expect(financialAccountIdentifierSource).toContain("<Button");
    expect(financialAccountIdentifierSource).not.toContain("styles.primaryButton");
    expect(transactionActionSource).toContain(
      'import { Button, FidyNumpad } from "@/shared/components"'
    );
    expect(transactionActionSource).toContain("<Button");
    expect(transactionActionSource).not.toContain("<Pressable");
    expect(transactionActionSource).not.toContain("styles.saveButton");
    expect(transactionActionSource).not.toContain("styles.deleteButton");
    expect(transactionActionSource).not.toContain("styles.extraActionButton");
  });

  it("keeps remaining save and CTA buttons on the shared Button primitive", () => {
    const files = [
      "../../features/budget/components/create-budget/CreateBudgetFormContent.tsx",
      "../../features/calendar/components/add-bill/AddBillFormContent.tsx",
      "../../features/goals/components/AddPaymentSheet.tsx",
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
});
