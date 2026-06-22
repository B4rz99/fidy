import type { CloudLedgerBootstrapPayload, LedgerCursor } from "./model.ts";
import { throwIfError, type SupabaseError } from "../_shared/supabase-error.ts";
import { readLedgerCursorSequence } from "./model.ts";

type SupabaseLike = {
  rpc(
    functionName: string,
    args: {
      readonly p_user_id: string;
      readonly p_after_sequence: string | null;
    }
  ): Promise<{
    readonly data: CloudLedgerBootstrapPayload | null;
    readonly error: SupabaseError;
  }>;
};

const CLOUD_LEDGER_BOOTSTRAP_RPC = "cloud_ledger_bootstrap";
// ADR-0007/#532 make Supabase-backed Cloud Ledger the financial source of truth;
// this service-role RPC is the Remote API Boundary, not mobile direct table access.

export function createCloudLedgerStore(supabase: SupabaseLike) {
  return {
    bootstrapLedger: (userId: string, cursor: LedgerCursor | null) =>
      bootstrapLedger(supabase, userId, cursor),
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
  return response.data;
}
