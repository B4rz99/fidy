import { describe, expect, it } from "vitest";
import { seedHomeActivityAttributionReviewRows } from "@/features/qa/lib/home-activity-review-seed";
import type { TransactionRow } from "@/features/transactions/query.public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const NOW = new Date("2026-04-19T10:00:00.000Z");

const transaction = (
  id: string,
  accountAttributionState: TransactionRow["accountAttributionState"]
): TransactionRow => ({
  id: id as TransactionId,
  userId: USER_ID,
  type: "expense",
  amount: 10000 as CopAmount,
  categoryId: "food" as CategoryId,
  description: "Cafe",
  counterpartyName: "",
  date: "2026-04-19" as IsoDate,
  accountId: "fa-1" as FinancialAccountId,
  accountAttributionState,
  supersededAt: null,
  supersededByTransferId: null,
  source: "email_capture",
  createdAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
  updatedAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
  voidedAt: null,
});

describe("seedHomeActivityAttributionReviewRows", () => {
  it("returns null without unresolved and confirmed transaction examples", () => {
    expect(
      seedHomeActivityAttributionReviewRows({
        userId: USER_ID,
        transactions: [transaction("tx-1", "unresolved")],
        now: NOW,
      })
    ).toBeNull();
  });

  it("builds matching source event and evidence rows", () => {
    const result = seedHomeActivityAttributionReviewRows({
      userId: USER_ID,
      transactions: [
        transaction("tx-unresolved", "unresolved"),
        transaction("tx-confirmed", "confirmed"),
      ],
      now: NOW,
    });

    expect(result?.sourceEvents).toHaveLength(2);
    expect(result?.evidenceRows).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        value: "Bancolombia",
        transactionId: "tx-unresolved",
        processedSourceEventId: result?.sourceEvents[0]?.id,
      }),
      expect.objectContaining({
        userId: USER_ID,
        value: "Bancolombia",
        transactionId: "tx-confirmed",
        processedSourceEventId: result?.sourceEvents[1]?.id,
      }),
    ]);
  });
});
