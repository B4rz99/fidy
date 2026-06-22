export type LedgerCursor = string;

const LEDGER_CURSOR_PATTERN = /^ledger:(0|[1-9]\d*)$/;

export function isLedgerCursor(value: string): value is LedgerCursor {
  return LEDGER_CURSOR_PATTERN.test(value);
}

export function readLedgerCursorSequence(cursor: LedgerCursor): string {
  const match = LEDGER_CURSOR_PATTERN.exec(cursor);
  if (match === null) {
    throw new Error("Invalid Ledger Cursor");
  }
  const sequence = match[1];
  if (sequence === undefined) {
    throw new Error("Invalid Ledger Cursor");
  }
  return sequence;
}

export function toLedgerCursor(sequence: number): LedgerCursor {
  return `ledger:${sequence}`;
}

export type CloudLedgerCategory = {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly color: string | null;
  readonly updatedAt: string;
};

export type CloudLedgerFinancialAccount = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly currency: "COP";
  readonly updatedAt: string;
};

export type CloudLedgerTransaction = {
  readonly id: string;
  readonly type: "income" | "expense";
  readonly amount: number;
  readonly currency: "COP";
  readonly categoryId: string | null;
  readonly accountId: string;
  readonly description: string | null;
  readonly date: string;
  readonly updatedAt: string;
};

export type CloudLedgerTombstoneRecordType = "category" | "financialAccount" | "transaction";

export type CloudLedgerTombstone = {
  readonly recordType: CloudLedgerTombstoneRecordType;
  readonly recordId: string;
  readonly deletedAt: string;
};

export type CloudLedgerBootstrapPayload = {
  readonly cursor: LedgerCursor;
  readonly categories: readonly CloudLedgerCategory[];
  readonly financialAccounts: readonly CloudLedgerFinancialAccount[];
  readonly transactions: readonly CloudLedgerTransaction[];
  readonly tombstones: readonly CloudLedgerTombstone[];
};

export type CloudLedgerApiError =
  | "missing_auth"
  | "invalid_auth"
  | "method_not_allowed"
  | "unsupported_action"
  | "invalid_cursor"
  | "internal_error";

export type CloudLedgerApiResponse =
  | { readonly success: true; readonly data: CloudLedgerBootstrapPayload }
  | { readonly success: false; readonly error: CloudLedgerApiError };
