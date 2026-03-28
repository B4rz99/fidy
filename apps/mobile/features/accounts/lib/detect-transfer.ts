import type { AccountId, CopAmount, IsoDate, TransactionId } from "@/shared/types/branded";

type NewTransaction = {
  readonly type: "expense" | "income";
  readonly amount: CopAmount;
  readonly accountId: AccountId;
  readonly date: IsoDate;
};

type TransferCandidate = {
  readonly id: TransactionId;
  readonly type: string;
  readonly amount: CopAmount;
  readonly accountId: AccountId;
  readonly date: IsoDate;
  readonly linkedTransactionId: TransactionId | null;
};

function daysBetween(a: IsoDate, b: IsoDate): number {
  const msPerDay = 86400000;
  const dateA = new Date(a).getTime();
  const dateB = new Date(b).getTime();
  return Math.abs(dateA - dateB) / msPerDay;
}

export function detectTransferCounterpart(
  newTx: NewTransaction,
  candidates: readonly TransferCandidate[]
): TransactionId | null {
  const oppositeType = newTx.type === "expense" ? "income" : "expense";

  const matches = candidates.filter(
    (c) =>
      c.type === oppositeType &&
      c.amount === newTx.amount &&
      c.accountId !== newTx.accountId &&
      c.linkedTransactionId === null &&
      daysBetween(c.date, newTx.date) <= 1
  );

  // Only link if exactly 1 match (avoid ambiguity)
  return matches.length === 1 ? matches[0].id : null;
}
