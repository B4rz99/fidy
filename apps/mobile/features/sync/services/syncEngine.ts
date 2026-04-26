// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnyDb } from "@/shared/db";
import { syncPull } from "./sync-engine/pull";
import { syncPush } from "./sync-engine/push";
import type { SyncPushRequest } from "./sync-engine/types";

export { syncPull, syncPush };

export async function fullSync(
  db: AnyDb,
  supabase: SupabaseClient,
  request: SyncPushRequest
): Promise<boolean> {
  const pullOk =
    request.remoteFinancialSync === "legacy" ? await syncPull(db, supabase, request.userId) : true;
  if (pullOk) {
    await syncPush(db, supabase, request);
  }
  return pullOk;
}
