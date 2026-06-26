import type {
  CaptureImprovementSample,
  CaptureImprovementSampleAccepted,
  CaptureImprovementSampleOutcome,
  CloudLedgerApplyPendingChangesCommand,
  CloudLedgerApplyPendingChangesOutcome,
  CloudLedgerBootstrapPayload,
  CloudLedgerCreateTransactionCommand,
  CloudLedgerCreateTransactionOutcome,
  LedgerCursor,
} from "./model.ts";
import { throwIfError, type SupabaseError } from "../_shared/supabase-error.ts";
import { CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT, readLedgerCursorSequence } from "./model.ts";

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

type RetainCaptureImprovementSampleRpcArgs = {
  readonly p_user_id: string;
  readonly p_source_channel: CaptureImprovementSample["sourceChannel"];
  readonly p_source_family: CaptureImprovementSample["sourceFamily"];
  readonly p_source_provider: CaptureImprovementSample["sourceProvider"] | null;
  readonly p_provider_category: CaptureImprovementSample["providerCategory"];
  readonly p_template_shape: string;
  readonly p_parse_outcome: CaptureImprovementSample["parseOutcome"];
  readonly p_confidence_bucket: CaptureImprovementSample["confidenceBucket"];
  readonly p_extractor_method: CaptureImprovementSample["extractor"]["method"];
  readonly p_extractor_version: 1;
};

type DeleteCaptureImprovementSamplesRpcArgs = {
  readonly p_user_id: string;
};

type SetCaptureImprovementPreferenceRpcArgs = {
  readonly p_user_id: string;
  readonly p_enabled: boolean;
};

type SupabaseLike = {
  rpc(
    functionName: string,
    args:
      | BootstrapRpcArgs
      | CreateTransactionRpcArgs
      | DeleteCaptureImprovementSamplesRpcArgs
      | RetainCaptureImprovementSampleRpcArgs
      | SetCaptureImprovementPreferenceRpcArgs
  ): Promise<{
    readonly data:
      | CaptureImprovementSampleAccepted
      | CaptureImprovementSampleOutcome
      | CloudLedgerBootstrapPayload
      | CloudLedgerCreateTransactionOutcome
      | null;
    readonly error: SupabaseError;
  }>;
};

type ApplyPendingChangesProgress = {
  readonly acceptedChangeIds: readonly string[];
  readonly cursor: string | null;
  readonly rejectedChangeIds: readonly string[];
};

const CLOUD_LEDGER_BOOTSTRAP_RPC = "cloud_ledger_bootstrap";
const CLOUD_LEDGER_CREATE_TRANSACTION_RPC = "cloud_ledger_create_transaction";
const CLOUD_LEDGER_RETAIN_CAPTURE_IMPROVEMENT_SAMPLE_RPC =
  "cloud_ledger_retain_capture_improvement_sample";
const CLOUD_LEDGER_DELETE_CAPTURE_IMPROVEMENT_SAMPLES_RPC =
  "cloud_ledger_delete_capture_improvement_samples";
const CLOUD_LEDGER_SET_CAPTURE_IMPROVEMENT_PREFERENCE_RPC =
  "cloud_ledger_set_capture_improvement_preference";
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
    retainCaptureImprovementSample: (userId: string, sample: CaptureImprovementSample) =>
      retainCaptureImprovementSample(supabase, userId, sample),
    deleteCaptureImprovementSamples: (userId: string) =>
      deleteCaptureImprovementSamples(supabase, userId),
    setCaptureImprovementPreference: (userId: string, enabled: boolean) =>
      setCaptureImprovementPreference(supabase, userId, enabled),
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
  if (command.changes.length > CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT) {
    throw new Error("Cloud Ledger pending-change batch exceeds the server limit");
  }

  const outcomes = await command.changes.reduce<Promise<ApplyPendingChangesProgress>>(
    async (previous, change) => {
      const accepted = await previous;
      const outcome = await createTransaction(supabase, userId, {
        commandVersion: change.commandVersion,
        transaction: change.transaction,
      });
      if (outcome.code !== "accepted") {
        return {
          ...accepted,
          rejectedChangeIds: [...accepted.rejectedChangeIds, change.id],
        };
      }
      return {
        acceptedChangeIds: [...accepted.acceptedChangeIds, change.id],
        cursor: outcome.cursor,
        rejectedChangeIds: accepted.rejectedChangeIds,
      };
    },
    Promise.resolve({ acceptedChangeIds: [], cursor: null, rejectedChangeIds: [] })
  );

  return {
    code: "accepted",
    acceptedChangeIds: outcomes.acceptedChangeIds,
    rejectedChangeIds: outcomes.rejectedChangeIds,
    cursor: (outcomes.cursor ?? "ledger:0") as LedgerCursor,
  };
}

async function retainCaptureImprovementSample(
  supabase: SupabaseLike,
  userId: string,
  sample: CaptureImprovementSample
): Promise<CaptureImprovementSampleOutcome> {
  const response = await supabase.rpc(CLOUD_LEDGER_RETAIN_CAPTURE_IMPROVEMENT_SAMPLE_RPC, {
    p_confidence_bucket: sample.confidenceBucket,
    p_extractor_method: sample.extractor.method,
    p_extractor_version: sample.extractor.version,
    p_parse_outcome: sample.parseOutcome,
    p_provider_category: sample.providerCategory,
    p_source_channel: sample.sourceChannel,
    p_source_family: sample.sourceFamily,
    p_source_provider: sample.sourceProvider ?? null,
    p_template_shape: sample.templateShape,
    p_user_id: userId,
  });

  throwIfError(response.error, "retain Capture Improvement Sample");
  if (response.data === null) {
    throw new Error("Unable to retain Capture Improvement Sample: missing response");
  }
  return response.data as CaptureImprovementSampleOutcome;
}

async function deleteCaptureImprovementSamples(
  supabase: SupabaseLike,
  userId: string
): Promise<CaptureImprovementSampleAccepted> {
  const response = await supabase.rpc(CLOUD_LEDGER_DELETE_CAPTURE_IMPROVEMENT_SAMPLES_RPC, {
    p_user_id: userId,
  });

  throwIfError(response.error, "delete Capture Improvement Samples");
  if (response.data === null) {
    throw new Error("Unable to delete Capture Improvement Samples: missing response");
  }
  return response.data as CaptureImprovementSampleAccepted;
}

async function setCaptureImprovementPreference(
  supabase: SupabaseLike,
  userId: string,
  enabled: boolean
): Promise<CaptureImprovementSampleAccepted> {
  const response = await supabase.rpc(CLOUD_LEDGER_SET_CAPTURE_IMPROVEMENT_PREFERENCE_RPC, {
    p_enabled: enabled,
    p_user_id: userId,
  });

  throwIfError(response.error, "set Capture Improvement Preference");
  if (response.data === null) {
    throw new Error("Unable to set Capture Improvement Preference: missing response");
  }
  return response.data as CaptureImprovementSampleAccepted;
}
