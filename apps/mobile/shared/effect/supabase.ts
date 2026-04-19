import type { SupabaseClient } from "@supabase/supabase-js";
import { Effect } from "effect";
import { getSupabase } from "@/shared/db/supabase";
import { type BoundAppService, fromSync, makeAppService } from "./runtime";

export type AppSupabase = {
  readonly getSupabase: () => SupabaseClient;
};

export const liveAppSupabase: AppSupabase = {
  getSupabase,
};

export const AppSupabaseService = makeAppService<AppSupabase>("@/shared/effect/AppSupabase");

export const currentSupabaseClientEffect = Effect.flatMap(
  AppSupabaseService.tag,
  ({ getSupabase }) => fromSync(getSupabase)
);

export function bindAppSupabase(
  supabase: AppSupabase = liveAppSupabase
): BoundAppService<AppSupabase, AppSupabase> {
  return AppSupabaseService.bind(supabase);
}
