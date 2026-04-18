type SubscribeBudgetToTransactionsInput = {
  readonly subscribeTransactions: (listener: () => void) => () => void;
  readonly getTransactionDataRevision: () => number;
  readonly hasLoadedBudgetState: () => boolean;
  readonly reload: () => void;
};

export function subscribeBudgetToTransactions({
  subscribeTransactions,
  getTransactionDataRevision,
  hasLoadedBudgetState,
  reload,
}: SubscribeBudgetToTransactionsInput): () => void {
  let previousRevision = getTransactionDataRevision();

  return subscribeTransactions(() => {
    const currentRevision = getTransactionDataRevision();
    if (currentRevision === previousRevision) return;
    previousRevision = currentRevision;
    if (!hasLoadedBudgetState()) return;
    reload();
  });
}
