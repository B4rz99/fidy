type SubscribeAnalyticsToTransactionsInput = {
  readonly subscribeTransactions: (listener: () => void) => () => void;
  readonly getTransactionPages: () => unknown;
  readonly hasLoadedAnalytics: () => boolean;
  readonly reload: () => void;
};

export function subscribeAnalyticsToTransactions({
  subscribeTransactions,
  getTransactionPages,
  hasLoadedAnalytics,
  reload,
}: SubscribeAnalyticsToTransactionsInput): () => void {
  let previousPages = getTransactionPages();

  return subscribeTransactions(() => {
    const currentPages = getTransactionPages();
    if (currentPages === previousPages) return;
    previousPages = currentPages;
    if (!hasLoadedAnalytics()) return;
    reload();
  });
}
