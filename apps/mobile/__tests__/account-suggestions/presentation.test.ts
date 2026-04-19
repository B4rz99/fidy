import { describe, expect, it } from "vitest";
import type { FinancialAccountRow } from "@/features/financial-accounts";
import {
  buildSuggestedFinancialAccountDraft,
  rankSuggestedFinancialAccounts,
} from "@/features/account-suggestions/lib/presentation";
import { requireIsoDateTime, requireUserId } from "@/shared/types/assertions";
import type { FinancialAccountId } from "@/shared/types/branded";

const USER_ID = requireUserId("user-1");
const NOW = requireIsoDateTime("2026-04-19T12:00:00.000Z");

const ACCOUNTS = [
  {
    id: "fa-default-user-1" as FinancialAccountId,
    userId: USER_ID,
    name: "Cash",
    kind: "cash",
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "fa-nequi" as FinancialAccountId,
    userId: USER_ID,
    name: "Nequi wallet",
    kind: "wallet",
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "fa-davivienda" as FinancialAccountId,
    userId: USER_ID,
    name: "Davivienda Visa",
    kind: "credit_card",
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
] satisfies readonly FinancialAccountRow[];

describe("account suggestion presentation helpers", () => {
  it("builds a wallet draft from alias-token evidence", () => {
    expect(
      buildSuggestedFinancialAccountDraft({
        fingerprint: '["notification:nequi:alias","wallet"]',
        scope: "notification:nequi:alias",
        value: "wallet",
        sourceFamily: "nequi",
        evidenceType: "alias_token",
        occurrences: 3,
        confidenceScore: 180,
      })
    ).toEqual({
      confidenceLabel: "MED",
      evidenceLabel: "wallet",
      kind: "wallet",
      name: "Nequi wallet",
      occurrences: 3,
      sourceLabel: "Nequi",
    });
  });

  it("builds a checking-account draft from last4 evidence", () => {
    expect(
      buildSuggestedFinancialAccountDraft({
        fingerprint: '["notification:bancolombia:last4","1234"]',
        scope: "notification:bancolombia:last4",
        value: "1234",
        sourceFamily: "bancolombia",
        evidenceType: "last4",
        occurrences: 2,
        confidenceScore: 200,
      })
    ).toEqual({
      confidenceLabel: "HIGH",
      evidenceLabel: "••1234",
      kind: "checking",
      name: "Bancolombia ••1234",
      occurrences: 2,
      sourceLabel: "Bancolombia",
    });
  });

  it("ranks likely matching financial accounts before the rest", () => {
    const ranked = rankSuggestedFinancialAccounts(ACCOUNTS, {
      fingerprint: '["notification:nequi:alias","wallet"]',
      scope: "notification:nequi:alias",
      value: "wallet",
      sourceFamily: "nequi",
      evidenceType: "alias_token",
      occurrences: 3,
      confidenceScore: 180,
    });

    expect(ranked.map((row) => row.account.id)).toEqual([
      "fa-nequi",
      "fa-davivienda",
      "fa-default-user-1",
    ]);
    expect(ranked.map((row) => row.isLikelyMatch)).toEqual([true, false, false]);
  });
});
