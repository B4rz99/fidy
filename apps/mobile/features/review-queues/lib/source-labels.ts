type ReviewQueueSourceEvent = {
  readonly sourceId: string;
};

export function getReviewQueueProviderLabel(
  sourceEvent: ReviewQueueSourceEvent,
  t: (key: string) => string
) {
  if (sourceEvent.sourceId === "email_gmail") return t("financialMeaningReview.providers.gmail");
  if (sourceEvent.sourceId === "email_outlook") {
    return t("financialMeaningReview.providers.outlook");
  }

  return sourceEvent.sourceId;
}
