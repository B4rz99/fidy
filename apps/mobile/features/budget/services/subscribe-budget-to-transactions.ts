type SubscribeBudgetToTransactionsInput = {
  readonly subscribeTransactions: (listener: () => void) => () => void;
  readonly getTransactionDataRevision: () => number;
  readonly hasLoadedBudgetState: () => boolean;
  readonly reload: () => void;
};

type BudgetReloadAction = "queue" | "reload" | "skip";
type BudgetReloadState = {
  readonly currentRevision: number;
  readonly previousRevision: number;
  readonly hasLoadedBudgetState: boolean;
  readonly hasPendingReload: boolean;
};

function getBudgetReloadAction(input: BudgetReloadState): BudgetReloadAction {
  if (!input.hasLoadedBudgetState) {
    return input.currentRevision !== input.previousRevision ? "queue" : "skip";
  }
  return input.currentRevision === input.previousRevision && !input.hasPendingReload
    ? "skip"
    : "reload";
}

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
    const action = getBudgetReloadAction({
      currentRevision,
      previousRevision,
      hasLoadedBudgetState: hasLoadedBudgetState(),
      hasPendingReload,
    });

    if (action === "queue") {
      hasPendingReload = true;
      return;
    }
    if (action === "skip") return;

    previousRevision = currentRevision;
    hasPendingReload = false;
    reload();
  });
}
