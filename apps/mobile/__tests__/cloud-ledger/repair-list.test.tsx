import { describe, expect, it, vi } from "vitest";
import { CloudLedgerRepairList } from "@/features/cloud-ledger/ui.public";
import type { CloudLedgerRepairItem } from "@/features/cloud-ledger/outbox.public";
import { renderFidy } from "@/__tests__/helpers/render";
import i18n from "@/shared/i18n/i18n";
import {
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireTransactionId,
} from "@/shared/types/assertions";

describe("Cloud Ledger repair list", () => {
  it("renders localized repair actions and dispatches typed action callbacks", () => {
    i18n.locale = "en";
    const onDiscard = vi.fn();
    const onEditAndResubmit = vi.fn();
    const onRetry = vi.fn();
    const onRetrySet = vi.fn();
    const screen = renderFidy(
      <CloudLedgerRepairList
        items={[
          repairItem({
            reason: "staleConflict",
            code: "stale_expected_version",
            actions: ["editAndResubmit", "discard"],
          }),
          repairItem({
            reason: "retryableFailure",
            status: "retryable",
            code: "edge_function_unavailable",
            actions: ["retry", "discard"],
          }),
          repairItem({
            reason: "dependencyFailure",
            code: "dependency_failed",
            actions: ["discard"],
            parentChangeId: "change-parent-invalid",
          }),
        ]}
        onDiscard={onDiscard}
        onEditAndResubmit={onEditAndResubmit}
        onRetry={onRetry}
        onRetrySet={onRetrySet}
      />
    );

    expect(screen.getByText("Transaction changed elsewhere")).toBeTruthy();
    expect(screen.getByText("Sync did not finish")).toBeTruthy();
    expect(screen.getByText(/change-parent-invalid/)).toBeTruthy();
    expect(screen.queryByText("stale_expected_version")).toBeNull();

    screen.pressByText("Edit and resubmit");
    screen.pressByText("Retry sync");
    const discardButton = screen.getAllByText("Discard change")[0];
    if (discardButton === undefined) {
      throw new Error("Expected a discard button");
    }
    screen.press(discardButton);

    expect(onEditAndResubmit).toHaveBeenCalledWith(requireLedgerChangeId("change-staleConflict"));
    expect(onRetry).toHaveBeenCalledWith(requireLedgerChangeId("change-retryableFailure"));
    expect(onDiscard).toHaveBeenCalledWith(requireLedgerChangeId("change-staleConflict"));
  });

  it("renders a reachable Pending Change Set retry action when multiple retryable repairs are visible", () => {
    i18n.locale = "en";
    const onRetrySet = vi.fn();
    const screen = renderFidy(
      <CloudLedgerRepairList
        items={[
          repairItem({
            reason: "retryableFailure",
            status: "retryable",
            code: "edge_function_unavailable",
            actions: ["retry", "discard"],
          }),
          repairItem({
            reason: "retryableFailure",
            status: "retryable",
            code: "edge_function_unavailable",
            actions: ["retry", "discard"],
            changeId: "change-retryableFailure-two",
          }),
        ]}
        onDiscard={vi.fn()}
        onEditAndResubmit={vi.fn()}
        onRetry={vi.fn()}
        onRetrySet={onRetrySet}
      />
    );

    screen.pressByText("Retry all changes");

    expect(onRetrySet).toHaveBeenCalledOnce();
  });

  it("hides the Pending Change Set retry action when a visible repair is not retryable", () => {
    i18n.locale = "en";
    const screen = renderFidy(
      <CloudLedgerRepairList
        items={[
          repairItem({
            reason: "retryableFailure",
            status: "retryable",
            code: "edge_function_unavailable",
            actions: ["retry", "discard"],
          }),
          repairItem({
            reason: "invalidTransaction",
            code: "invalid_transaction",
            actions: ["editAndResubmit", "discard"],
            changeId: "change-invalidTransaction-two",
          }),
        ]}
        onDiscard={vi.fn()}
        onEditAndResubmit={vi.fn()}
        onRetry={vi.fn()}
        onRetrySet={vi.fn()}
      />
    );

    expect(screen.queryByText("Retry all changes")).toBeNull();
  });
});

function repairItem(input: {
  readonly actions: CloudLedgerRepairItem["actions"];
  readonly changeId?: string;
  readonly code: string;
  readonly parentChangeId?: string;
  readonly reason: CloudLedgerRepairItem["reason"];
  readonly status?: CloudLedgerRepairItem["outcome"]["status"];
}): CloudLedgerRepairItem {
  const changeId = requireLedgerChangeId(input.changeId ?? `change-${input.reason}`);
  return {
    id: changeId,
    kind: "createTransaction",
    change: {
      id: changeId,
      kind: "createTransaction",
      commandVersion: 1,
      transaction: {
        id: requireTransactionId(`txn-${input.reason}`),
        type: "expense",
        amount: requireCopAmount(18_000),
        currency: "COP",
        categoryId: null,
        accountId: requireFinancialAccountId("acct-cash"),
        description: "Coffee",
        date: requireIsoDate("2026-06-02"),
      },
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
    },
    outcome: {
      changeId,
      status: input.status ?? "repair_required",
      code: input.code,
    },
    ...(input.parentChangeId === undefined
      ? {}
      : { parentChangeId: requireLedgerChangeId(input.parentChangeId) }),
    reason: input.reason,
    actions: input.actions,
  };
}
