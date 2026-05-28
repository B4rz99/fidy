import type { FinancialAccountKind } from "../schema";

const KIND_EMOJI_BY_KIND = {
  checking: "🏦",
  savings: "🐷",
  wallet: "👛",
  cash: "💵",
  credit_card: "💳",
} satisfies Record<FinancialAccountKind, string>;

export function getKindEmoji(kind: FinancialAccountKind) {
  return KIND_EMOJI_BY_KIND[kind];
}
