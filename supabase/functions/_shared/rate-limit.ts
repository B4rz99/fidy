// biome-ignore-all lint/style/useNamingConvention: Supabase RPC parameter names
import { createClient } from "npm:@supabase/supabase-js@2";

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

type RateLimitResult =
  | { allowed: true; count: number }
  | { allowed: false; count: number; retryAfterSeconds: number; unavailable?: true };

export async function checkRateLimit(
  userId: string,
  functionName: string,
  maxPerMinute: number
): Promise<RateLimitResult> {
  const now = new Date();
  const windowKey = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const retryAfterSeconds = 60 - now.getSeconds();

  try {
    const { data, error } = await serviceClient.rpc("check_rate_limit", {
      p_user_id: userId,
      p_function_name: functionName,
      p_window_key: windowKey,
      p_max_count: maxPerMinute,
    });

    if (error) {
      console.error("Rate limit RPC error, failing closed:", error.message);
      return { allowed: false, count: 0, retryAfterSeconds, unavailable: true };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== "boolean") {
      console.error("Rate limit RPC returned no data, failing closed");
      return { allowed: false, count: 0, retryAfterSeconds, unavailable: true };
    }

    if (row.allowed) {
      return { allowed: true, count: row.current_count };
    }

    return { allowed: false, count: row.current_count, retryAfterSeconds };
  } catch (err) {
    console.error("Rate limit check failed, failing closed:", err);
    return { allowed: false, count: 0, retryAfterSeconds, unavailable: true };
  }
}
