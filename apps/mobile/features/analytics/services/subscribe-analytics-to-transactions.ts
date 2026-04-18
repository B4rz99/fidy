type SubscribeAnalyticsToTransactionsInput = {
  readonly subscribeTransactions: (listener: () => void) => () => void;
  readonly getTransactionDataRevision: () => number;
  readonly hasLoadedAnalytics: () => boolean;
  readonly reload: () => void;
};

export function subscribeAnalyticsToTransactions({
  subscribeTransactions,
  getTransactionDataRevision,
  hasLoadedAnalytics,
  reload,
}: SubscribeAnalyticsToTransactionsInput): () => void {
  let previousRevision = getTransactionDataRevision();

  return subscribeTransactions(() => {
    const currentRevision = getTransactionDataRevision();
    if (currentRevision === previousRevision) return;
    previousRevision = currentRevision;
    if (!hasLoadedAnalytics()) return;
    reload();
  });
}
