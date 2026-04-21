type TransactionRow = {
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string | null;
  readonly date: string;
  readonly type: string;
  readonly deletedAt: string | null;
};

function toComparableTransactionValues(row: TransactionRow) {
  return [row.amount, row.categoryId, row.description, row.date, row.type, row.deletedAt] as const;
}

export function hasDataConflict(local: TransactionRow, server: TransactionRow): boolean {
  const localValues = toComparableTransactionValues(local);
  const serverValues = toComparableTransactionValues(server);
  return localValues.some((value, index) => value !== serverValues[index]);
}
