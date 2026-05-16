type TransactionDisplayNameInput = {
  readonly description: string;
  readonly counterpartyName?: string | null;
};

const normalizeDisplayText = (value: string | null | undefined): string => value?.trim() ?? "";

export const getTransactionDisplayName = (
  transaction: TransactionDisplayNameInput,
  fallback: string
): string =>
  normalizeDisplayText(transaction.description) ||
  normalizeDisplayText(transaction.counterpartyName) ||
  fallback;
