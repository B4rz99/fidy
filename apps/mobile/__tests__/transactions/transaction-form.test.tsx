import { describe, expect, it, vi } from "vitest";
import { TransactionForm } from "@/features/transactions/ui.public";
import { renderFidy } from "@/__tests__/helpers/render";
import i18n from "@/shared/i18n/i18n";

vi.mock("@/features/transfers/ui.public", () => ({
  useTransferEntry: () => ({
    digits: "",
    fields: null,
    isConfirmDisabled: true,
    onConfirm: vi.fn(),
    onKeyPress: vi.fn(),
    overlays: null,
  }),
}));

describe("TransactionForm", () => {
  it("can hide transfer mode for transaction-only flows", () => {
    i18n.locale = "en";

    const screen = renderFidy(
      <TransactionForm
        type="expense"
        allowTransferMode={false}
        digits="18000"
        categories={[]}
        categoryId={null}
        accounts={[]}
        accountId={null}
        description="Coffee"
        date={new Date("2026-06-02T00:00:00.000Z")}
        saveLabel="Save"
        isSaving={false}
        onTypeChange={vi.fn()}
        onDigitsChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onAccountChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onDateChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("Expense")).toBeTruthy();
    expect(screen.getByText("Income")).toBeTruthy();
    expect(screen.queryByText("Transfer")).toBeNull();
  });
});
