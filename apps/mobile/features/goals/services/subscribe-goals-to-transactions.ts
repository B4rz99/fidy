type SubscribeGoalsToTransactionsInput = {
  readonly subscribeTransactions: (listener: () => void) => () => void;
  readonly getTransactionPages: () => unknown;
  readonly hasLoadedGoals: () => boolean;
  readonly reload: () => void;
};

export function subscribeGoalsToTransactions({
  subscribeTransactions,
  getTransactionPages,
  hasLoadedGoals,
  reload,
}: SubscribeGoalsToTransactionsInput): () => void {
  let previousPages = getTransactionPages();

  return subscribeTransactions(() => {
    const currentPages = getTransactionPages();
    if (currentPages === previousPages) return;
    previousPages = currentPages;
    if (!hasLoadedGoals()) return;
    reload();
  });
}
