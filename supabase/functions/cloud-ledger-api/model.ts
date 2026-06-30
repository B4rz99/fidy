import type { CloudLedgerApplyPendingChangesAccepted } from "./pending-change-set-model.ts";

export type LedgerCursor = string;

export { CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT } from "./pending-change-set-model.ts";
export type {
  CloudLedgerApplyPendingChange,
  CloudLedgerApplyPendingChangesAccepted,
  CloudLedgerApplyPendingChangesCommand,
  CloudLedgerApplyPendingChangesOutcome,
  CloudLedgerApplyPendingCreateTransactionChange,
  CloudLedgerApplyPendingInvalidChange,
  CloudLedgerApplyPendingUnsupportedChange,
  CloudLedgerApplyPendingUnsupportedEnvelopeChange,
  CloudLedgerExpectedRecordVersion,
  CloudLedgerPendingChangeOutcome,
} from "./pending-change-set-model.ts";

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

export type CloudLedgerCreateTransactionCommand = {
  readonly commandVersion: 1;
  readonly transaction: {
    readonly id: string;
    readonly type: "income" | "expense";
    readonly amount: number;
    readonly currency: "COP";
    readonly categoryId: string | null;
    readonly accountId: string;
    readonly description: string | null;
    readonly date: string;
  };
};

export type CloudLedgerCreateTransactionAccepted = {
  readonly code: "accepted";
  readonly transaction: CloudLedgerTransaction;
  readonly cursor: LedgerCursor;
};

export type CloudLedgerCreateTransactionRejected = {
  readonly code:
    | "duplicate_transaction_id"
    | "invalid_ledger_reference"
    | "invalid_transaction"
    | "invalid_transaction_id"
    | "unauthorized_transaction_id"
    | "unsupported_command_version";
};

export type CloudLedgerCreateTransactionOutcome =
  | CloudLedgerCreateTransactionAccepted
  | CloudLedgerCreateTransactionRejected;

export type CaptureImprovementSample = {
  readonly sourceChannel: "email" | "notification" | "wallet";
  readonly sourceFamily: "email" | "android_notification" | "wallet_notification";
  readonly sourceProvider?: "gmail" | "outlook";
  readonly providerCategory: "bank" | "payment_app" | "wallet" | "unknown";
  readonly templateShape: string;
  readonly parseOutcome: "failed" | "needs_review";
  readonly confidenceBucket: "none" | "low" | "medium" | "high";
  readonly extractor: {
    readonly method: "regex" | "llm";
    readonly version: 1;
  };
};

export type CaptureImprovementSampleAccepted = {
  readonly code: "accepted";
};

export type CaptureImprovementSampleRejected = {
  readonly code: "capture_improvement_opted_out" | "invalid_capture_improvement_sample";
};

export type CaptureImprovementSampleOutcome =
  | CaptureImprovementSampleAccepted
  | CaptureImprovementSampleRejected;

export type CloudLedgerApiError =
  | "missing_auth"
  | "invalid_auth"
  | "method_not_allowed"
  | "unsupported_action"
  | "invalid_cursor"
  | "invalid_capture_improvement_sample"
  | "unsafe_capture_improvement_sample"
  | "capture_improvement_opted_out"
  | "duplicate_transaction_id"
  | "invalid_ledger_reference"
  | "invalid_transaction"
  | "invalid_transaction_id"
  | "pending_change_batch_too_large"
  | "unauthorized_transaction_id"
  | "unsupported_command_version"
  | "internal_error";

export type CloudLedgerApiResponse =
  | { readonly success: true; readonly data: CloudLedgerBootstrapPayload }
  | { readonly success: true; readonly data: CloudLedgerCreateTransactionAccepted }
  | { readonly success: true; readonly data: CloudLedgerApplyPendingChangesAccepted }
  | { readonly success: true; readonly data: CaptureImprovementSampleAccepted }
  | { readonly success: false; readonly error: CloudLedgerApiError };
