export type SyncOutcome = {
  readonly savedCount: number;
  readonly hasAccountSuggestions: boolean;
  readonly importComplete: boolean;
};

export const RECENT_TRANSACTION_PREVIEW_LIMIT = 10;

const byRecentlyCaptured = (a: { readonly updatedAt: Date }, b: { readonly updatedAt: Date }) =>
  b.updatedAt.getTime() - a.updatedAt.getTime();

export const getRecentTransactionPreview = <T extends { readonly updatedAt: Date }>(
  transactions: readonly T[]
) => transactions.toSorted(byRecentlyCaptured).slice(0, RECENT_TRANSACTION_PREVIEW_LIMIT);
