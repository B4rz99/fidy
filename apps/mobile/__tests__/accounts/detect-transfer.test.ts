import { describe, expect, it } from "vitest";
import { detectTransferCounterpart } from "@/features/accounts/lib/detect-transfer";
import type { AccountId, CopAmount, IsoDate, TransactionId } from "@/shared/types/branded";

type TxCandidate = Parameters<typeof detectTransferCounterpart>[1][number];

const makeTx = (overrides: Partial<TxCandidate> & { id: string }): TxCandidate => ({
  id: overrides.id as TransactionId,
  type: overrides.type ?? "income",
  amount: (overrides.amount ?? 100000) as CopAmount,
  accountId: (overrides.accountId ?? "acct-2") as AccountId,
  date: overrides.date ?? ("2026-03-28" as IsoDate),
  linkedTransactionId: overrides.linkedTransactionId ?? null,
});

describe("detectTransferCounterpart", () => {
  const newTx = {
    type: "expense" as const,
    amount: 100000 as CopAmount,
    accountId: "acct-1" as AccountId,
    date: "2026-03-28" as IsoDate,
  };

  it("finds a counterpart with same amount, opposite type, different account, same date", () => {
    const candidates = [makeTx({ id: "tx-2" })];
    expect(detectTransferCounterpart(newTx, candidates)).toBe("tx-2");
  });

  it("returns null when no candidates", () => {
    expect(detectTransferCounterpart(newTx, [])).toBeNull();
  });

  it("skips candidate with same account", () => {
    const candidates = [makeTx({ id: "tx-2", accountId: "acct-1" })];
    expect(detectTransferCounterpart(newTx, candidates)).toBeNull();
  });

  it("skips candidate with same type", () => {
    const candidates = [makeTx({ id: "tx-2", type: "expense" })];
    expect(detectTransferCounterpart(newTx, candidates)).toBeNull();
  });

  it("skips candidate with different amount", () => {
    const candidates = [makeTx({ id: "tx-2", amount: 200000 })];
    expect(detectTransferCounterpart(newTx, candidates)).toBeNull();
  });

  it("skips candidate already linked", () => {
    const candidates = [makeTx({ id: "tx-2", linkedTransactionId: "tx-99" as TransactionId })];
    expect(detectTransferCounterpart(newTx, candidates)).toBeNull();
  });

  it("allows ±1 day date tolerance", () => {
    const candidates = [makeTx({ id: "tx-2", date: "2026-03-29" as IsoDate })];
    expect(detectTransferCounterpart(newTx, candidates)).toBe("tx-2");
  });

  it("rejects date difference > 1 day", () => {
    const candidates = [makeTx({ id: "tx-2", date: "2026-03-30" as IsoDate })];
    expect(detectTransferCounterpart(newTx, candidates)).toBeNull();
  });

  it("returns null when 2+ matches (ambiguous)", () => {
    const candidates = [makeTx({ id: "tx-2" }), makeTx({ id: "tx-3" })];
    expect(detectTransferCounterpart(newTx, candidates)).toBeNull();
  });
});
