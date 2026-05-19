export const selectNeedsReviewBannerCount = (state: {
  readonly needsReviewEmailSourceEvents: readonly unknown[];
}) => state.needsReviewEmailSourceEvents.length;

export const getFinancialMeaningQueueItemId = (item: {
  readonly reviewCandidate: { readonly id: string };
}) => item.reviewCandidate.id;
