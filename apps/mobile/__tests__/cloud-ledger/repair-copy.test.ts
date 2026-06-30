import { describe, expect, it } from "vitest";
import {
  describeCloudLedgerRepairItem,
  type CloudLedgerRepairItem,
} from "@/features/cloud-ledger/outbox.public";
import i18n from "@/shared/i18n/i18n";
import {
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireTransactionId,
} from "@/shared/types/assertions";

describe("Cloud Ledger repair copy", () => {
  it("maps typed repair reasons to localized copy without leaking backend strings", () => {
    i18n.locale = "en";
    const copies = [
      describeCloudLedgerRepairItem(
        repairItem({
          reason: "staleConflict",
          code: "stale_expected_version",
          actions: ["editAndResubmit", "discard"],
        }),
        i18n.t.bind(i18n)
      ),
      describeCloudLedgerRepairItem(
        repairItem({
          reason: "invalidTransaction",
          code: "invalid_transaction",
          actions: ["editAndResubmit", "discard"],
        }),
        i18n.t.bind(i18n)
      ),
      describeCloudLedgerRepairItem(
        repairItem({
          reason: "retryableFailure",
          status: "retryable",
          code: "edge_function_unavailable",
          actions: ["retry", "discard"],
        }),
        i18n.t.bind(i18n)
      ),
      describeCloudLedgerRepairItem(
        repairItem({
          reason: "dependencyFailure",
          code: "dependency_failed",
          actions: ["discard"],
          parentChangeId: "change-parent-invalid",
        }),
        i18n.t.bind(i18n)
      ),
      describeCloudLedgerRepairItem(
        repairItem({
          reason: "unsupportedCommandVersion",
          status: "requires_app_update",
          code: "unsupported_command_version",
          actions: ["discard"],
        }),
        i18n.t.bind(i18n)
      ),
    ];

    expect(copies[0]).toMatchObject({
      title: "Transaction changed elsewhere",
      actionLabels: [
        { action: "editAndResubmit", label: "Edit and resubmit" },
        { action: "discard", label: "Discard change" },
      ],
    });
    expect(copies[3]).toMatchObject({
      title: "Blocked by another change",
      parentChangeId: "change-parent-invalid",
    });
    expect(
      copies.flatMap((copy) => [
        copy.title,
        copy.body,
        ...copy.actionLabels.map((action) => action.label),
      ])
    ).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /stale_expected_version|invalid_transaction|edge_function_unavailable|dependency_failed|unsupported_command_version|repair_required|requires_app_update|retryable/
        ),
      ])
    );
  });
});

function repairItem(input: {
  readonly actions: CloudLedgerRepairItem["actions"];
  readonly code: string;
  readonly parentChangeId?: string;
  readonly reason: CloudLedgerRepairItem["reason"];
  readonly status?: CloudLedgerRepairItem["outcome"]["status"];
}): CloudLedgerRepairItem {
  const changeId = requireLedgerChangeId(`change-${input.reason}`);
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
