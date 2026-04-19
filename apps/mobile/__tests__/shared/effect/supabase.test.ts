import { describe, expect, it } from "vitest";
import { bindAppSupabase, currentSupabaseClientEffect } from "@/shared/effect/supabase";

describe("shared/effect/supabase", () => {
  it("runs the bound supabase service", async () => {
    const client = { from: () => ({}) } as never;
    const supabase = bindAppSupabase({
      getSupabase: () => client,
    });

    await expect(supabase.run(currentSupabaseClientEffect)).resolves.toBe(client);
  });
});
