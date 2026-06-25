import type {
  CloudLedgerApplyPendingChangesCommand,
  CloudLedgerApplyPendingChangesOutcome,
  CloudLedgerBootstrapPayload,
  CloudLedgerCreateTransactionCommand,
  CloudLedgerCreateTransactionOutcome,
  CloudLedgerCreateTransactionRejected,
  LedgerCursor,
} from "./model.ts";
import { throwIfError, type SupabaseError } from "../_shared/supabase-error.ts";
import { readLedgerCursorSequence } from "./model.ts";

type BootstrapRpcArgs = {
  readonly p_user_id: string;
  readonly p_after_sequence: string | null;
};

type CreateTransactionRpcArgs = {
  readonly p_user_id: string;
  readonly p_command_version: 1;
  readonly p_transaction_id: string;
  readonly p_type: "income" | "expense";
  readonly p_amount: number;
  readonly p_currency: "COP";
  readonly p_category_id: string | null;
  readonly p_account_id: string;
  readonly p_description: string | null;
  readonly p_date: string;
};

type SupabaseLike = {
  rpc(
    functionName: string,
    args: BootstrapRpcArgs | CreateTransactionRpcArgs
  ): Promise<{
    readonly data: CloudLedgerBootstrapPayload | CloudLedgerCreateTransactionOutcome | null;
    readonly error: SupabaseError;
  }>;
};

type ApplyPendingChangesProgress =
  | {
      readonly code: "accepted";
      readonly acceptedChangeIds: readonly string[];
      readonly cursor: string | null;
    }
  | CloudLedgerCreateTransactionRejected;

const CLOUD_LEDGER_BOOTSTRAP_RPC = "cloud_ledger_bootstrap";
const CLOUD_LEDGER_CREATE_TRANSACTION_RPC = "cloud_ledger_create_transaction";
// ADR-0007/#532 make Supabase-backed Cloud Ledger the financial source of truth;
// this service-role RPC is the Remote API Boundary, not mobile direct table access.

export function createCloudLedgerStore(supabase: SupabaseLike) {
  return {
    bootstrapLedger: (userId: string, cursor: LedgerCursor | null) =>
      bootstrapLedger(supabase, userId, cursor),
    createTransaction: (userId: string, command: CloudLedgerCreateTransactionCommand) =>
      createTransaction(supabase, userId, command),
    applyPendingChanges: (userId: string, command: CloudLedgerApplyPendingChangesCommand) =>
      applyPendingChanges(supabase, userId, command),
  };
}

async function bootstrapLedger(
  supabase: SupabaseLike,
  userId: string,
  cursor: LedgerCursor | null
): Promise<CloudLedgerBootstrapPayload> {
  const response = await supabase.rpc(CLOUD_LEDGER_BOOTSTRAP_RPC, {
    p_after_sequence: cursor === null ? null : readLedgerCursorSequence(cursor),
    p_user_id: userId,
  });

  throwIfError(response.error, "load Cloud Ledger bootstrap");
  if (response.data === null) {
    throw new Error("Unable to load Cloud Ledger bootstrap: missing response");
  }
  return response.data as CloudLedgerBootstrapPayload;
}

async function createTransaction(
  supabase: SupabaseLike,
  userId: string,
  command: CloudLedgerCreateTransactionCommand
): Promise<CloudLedgerCreateTransactionOutcome> {
  const response = await supabase.rpc(CLOUD_LEDGER_CREATE_TRANSACTION_RPC, {
    p_account_id: command.transaction.accountId,
    p_amount: command.transaction.amount,
    p_category_id: command.transaction.categoryId,
    p_command_version: command.commandVersion,
    p_currency: command.transaction.currency,
    p_date: command.transaction.date,
    p_description: command.transaction.description,
    p_transaction_id: command.transaction.id,
    p_type: command.transaction.type,
    p_user_id: userId,
  });

  throwIfError(response.error, "create Cloud Ledger transaction");
  if (response.data === null) {
    throw new Error("Unable to create Cloud Ledger transaction: missing response");
  }
  return response.data as CloudLedgerCreateTransactionOutcome;
}

async function applyPendingChanges(
  supabase: SupabaseLike,
  userId: string,
  command: CloudLedgerApplyPendingChangesCommand
): Promise<CloudLedgerApplyPendingChangesOutcome> {
  const outcomes = await command.changes.reduce<Promise<ApplyPendingChangesProgress>>(
    async (previous, change) => {
      const accepted = await previous;
      if (accepted.code !== "accepted") {
        return accepted;
      }
      const outcome = await createTransaction(supabase, userId, {
        commandVersion: change.commandVersion,
        transaction: change.transaction,
      });
      if (outcome.code !== "accepted") {
        return outcome;
      }
      return {
        code: "accepted",
        acceptedChangeIds: [...accepted.acceptedChangeIds, change.id],
        cursor: outcome.cursor,
      };
    },
    Promise.resolve({ code: "accepted", acceptedChangeIds: [], cursor: null })
  );

  if (outcomes.code !== "accepted") {
    return outcomes;
  }
  return {
    code: "accepted",
    acceptedChangeIds: outcomes.acceptedChangeIds,
    cursor: (outcomes.cursor ?? "ledger:0") as LedgerCursor,
  };
}
