type EmailSyncSnapshot = {
  readonly isFetching: boolean;
};

export function shouldRefreshBudgetSuggestions(
  previous: EmailSyncSnapshot,
  next: EmailSyncSnapshot
): boolean {
  return previous.isFetching && !next.isFetching;
}
