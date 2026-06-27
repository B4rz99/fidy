import type { CloudLedgerCreateTransactionCommand, LedgerCursor } from "./model.ts";

export const CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT = 10;

export type CloudLedgerApplyPendingCreateTransactionChange = {
  readonly id: string;
  readonly kind: "createTransaction";
  readonly commandVersion: 1;
  readonly idempotencyKey: string;
  readonly dependencies: readonly string[];
  readonly expectedVersions: readonly CloudLedgerExpectedRecordVersion[];
  readonly clientTimestamp: string;
  readonly transaction: CloudLedgerCreateTransactionCommand["transaction"];
};

export type CloudLedgerApplyPendingUnsupportedChange = {
  readonly id: string;
  readonly kind: string;
  readonly commandVersion: number;
  readonly idempotencyKey?: string;
  readonly dependencies?: readonly string[];
  readonly expectedVersions?: readonly CloudLedgerExpectedRecordVersion[];
  readonly clientTimestamp?: string;
  readonly transaction?: unknown;
};

export type CloudLedgerApplyPendingUnsupportedEnvelopeChange = {
  readonly id: string;
};

export type CloudLedgerApplyPendingInvalidChange = {
  readonly id: string;
  readonly kind: "invalidPendingChange";
  readonly commandVersion: 1;
  readonly idempotencyKey: string;
  readonly dependencies: readonly string[];
  readonly expectedVersions: readonly CloudLedgerExpectedRecordVersion[];
  readonly clientTimestamp: string;
  readonly invalidCode:
    | "invalid_ledger_reference"
    | "invalid_transaction"
    | "invalid_transaction_id";
};

export type CloudLedgerApplyPendingChange =
  | CloudLedgerApplyPendingCreateTransactionChange
  | CloudLedgerApplyPendingInvalidChange
  | CloudLedgerApplyPendingUnsupportedEnvelopeChange
  | CloudLedgerApplyPendingUnsupportedChange;

export type CloudLedgerExpectedRecordVersion = {
  readonly recordType: "transaction";
  readonly recordId: string;
  readonly version: number;
};

export type CloudLedgerApplyPendingChangesCommand = {
  readonly commandVersion: number;
  readonly deviceId: string | null;
  readonly batchId: string | null;
  readonly changes: readonly CloudLedgerApplyPendingChange[];
};

export type CloudLedgerApplyPendingChangesAccepted = {
  readonly code: "accepted";
  readonly acceptedChangeIds: readonly string[];
  readonly rejectedChangeIds: readonly string[];
  readonly changeOutcomes: readonly CloudLedgerPendingChangeOutcome[];
  readonly cursor: LedgerCursor;
};

export type CloudLedgerPendingChangeOutcome =
  | {
      readonly changeId: string;
      readonly status: "accepted";
      readonly code: "accepted";
    }
  | {
      readonly changeId: string;
      readonly status: "retryable";
      readonly code: "retryable_failure";
    }
  | {
      readonly changeId: string;
      readonly status: "repair_required";
      readonly code:
        | "dependency_failed"
        | "duplicate_transaction_id"
        | "duplicate_idempotency_key"
        | "invalid_ledger_reference"
        | "invalid_transaction"
        | "invalid_transaction_id"
        | "stale_expected_version"
        | "unauthorized_transaction_id";
    }
  | {
      readonly changeId: string;
      readonly status: "requires_app_update";
      readonly code: "unsupported_command_version";
    };

export type CloudLedgerApplyPendingChangesOutcome = CloudLedgerApplyPendingChangesAccepted;
