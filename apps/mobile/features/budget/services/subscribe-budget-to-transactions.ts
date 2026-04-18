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
  let hasPendingReload = false;

  return subscribeTransactions(() => {
    const currentRevision = getTransactionDataRevision();
    if (currentRevision !== previousRevision && !hasLoadedBudgetState()) {
      hasPendingReload = true;
      return;
    }
    if (currentRevision === previousRevision && !hasPendingReload) return;
    if (!hasLoadedBudgetState()) return;

    previousRevision = currentRevision;
    hasPendingReload = false;
    reload();
  });
}
