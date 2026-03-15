type TransactionRow = {
  readonly amountCents: number;
  readonly categoryId: string;
  readonly description: string | null;
  readonly date: string;
  readonly type: string;
  readonly deletedAt: string | null;
};

export function hasDataConflict(local: TransactionRow, server: TransactionRow): boolean {
  return (
    local.amountCents !== server.amountCents ||
    local.categoryId !== server.categoryId ||
    local.description !== server.description ||
    local.date !== server.date ||
    local.type !== server.type ||
    local.deletedAt !== server.deletedAt
  );
}
