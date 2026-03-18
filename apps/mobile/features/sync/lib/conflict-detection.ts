type TransactionRow = {
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string | null;
  readonly date: string;
  readonly type: string;
  readonly deletedAt: string | null;
};

export function hasDataConflict(local: TransactionRow, server: TransactionRow): boolean {
  return (
    local.amount !== server.amount ||
    local.categoryId !== server.categoryId ||
    local.description !== server.description ||
    local.date !== server.date ||
    local.type !== server.type ||
    local.deletedAt !== server.deletedAt
  );
}
