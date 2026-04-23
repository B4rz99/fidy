// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnyDb } from "@/shared/db";
import { syncPull } from "./sync-engine/pull";
import { syncPush } from "./sync-engine/push";

export { syncPull, syncPush };

export async function fullSync(
  db: AnyDb,
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const pullOk = await syncPull(db, supabase, userId);
  if (pullOk) {
    await syncPush(db, supabase, userId);
  }
  return pullOk;
}
