type SubscribeGoalsToTransactionsInput = {
  readonly subscribeTransactions: (listener: () => void) => () => void;
  readonly getTransactionDataRevision: () => number;
  readonly hasLoadedGoals: () => boolean;
  readonly reload: () => void;
};

export function subscribeGoalsToTransactions({
  subscribeTransactions,
  getTransactionDataRevision,
  hasLoadedGoals,
  reload,
}: SubscribeGoalsToTransactionsInput): () => void {
  let previousRevision = getTransactionDataRevision();

  return subscribeTransactions(() => {
    const currentRevision = getTransactionDataRevision();
    if (currentRevision === previousRevision) return;
    previousRevision = currentRevision;
    if (!hasLoadedGoals()) return;
    reload();
  });
}
