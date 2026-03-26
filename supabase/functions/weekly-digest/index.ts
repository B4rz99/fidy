// biome-ignore-all lint/style/useNamingConvention: Supabase column names and Expo Push API fields
// Weekly Digest Edge Function — Cron handler
//
// Sends a weekly spending summary push notification to all users with
// weekly_digest enabled and at least one registered push device.
//
// Cron setup (pg_cron — configure via Supabase dashboard or migration):
//   SELECT cron.schedule(
//     'weekly-digest',
//     '0 0 * * 1',  -- Every Monday at 00:00 UTC (Sunday 7:00 PM COT)
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/weekly-digest',
//       headers := jsonb_build_object(
//         'Authorization', 'Bearer ' || '<SUPABASE_SERVICE_ROLE_KEY>',
//         'Content-Type', 'application/json'
//       ),
//       body := '{}'::jsonb
//     )$$
//   );

import { createClient } from "npm:@supabase/supabase-js@2";
import { deriveDigestMessage, type WeeklyDigestData } from "../_shared/derive-digest.ts";

// ---------------------------------------------------------------------------
// Supabase client (service-role for cron — no user auth)
// ---------------------------------------------------------------------------

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ExpoPushMessage = {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: { readonly route: string };
};

type ExpoPushTicket =
  | { readonly status: "ok"; readonly id: string }
  | {
      readonly status: "error";
      readonly message: string;
      readonly details?: { readonly error: string };
    };

/** Split an array into chunks of a given size. */
const chunk = <T>(items: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

type UserDevice = {
  readonly user_id: string;
  readonly expo_push_token: string;
};

async function fetchEligibleDevices(): Promise<readonly UserDevice[]> {
  // Get all devices, then exclude users who explicitly disabled weekly_digest.
  // Users without a notification_preferences row are treated as opted-in (all defaults = true).
  const { data: devices, error: devError } = await serviceClient
    .from("push_devices")
    .select("user_id, expo_push_token, updated_at")
    .order("updated_at", { ascending: false });

  if (devError) {
    console.error("Failed to fetch push devices:", devError.message);
    return [];
  }

  if (!devices || devices.length === 0) return [];

  // Get users who explicitly opted out of weekly digest
  const { data: optedOut, error: prefError } = await serviceClient
    .from("notification_preferences")
    .select("user_id")
    .eq("weekly_digest", false);

  if (prefError) {
    console.error("Failed to fetch digest preferences:", prefError.message);
    return [];
  }

  // Deduplicate tokens FIRST: if multiple users share a token (e.g. failed signOut
  // cleanup), keep only the most recent registration (ordered by updated_at desc).
  // This must happen before opt-out filtering so the latest owner's preference wins.
  const seenTokens = new Set<string>();
  const latestPerToken = devices.filter((d: UserDevice) => {
    if (seenTokens.has(d.expo_push_token)) return false;
    seenTokens.add(d.expo_push_token);
    return true;
  });

  // Then filter out users who explicitly opted out of weekly digest.
  const optedOutIds = new Set((optedOut ?? []).map((r: { user_id: string }) => r.user_id));
  return latestPerToken.filter((d: UserDevice) => !optedOutIds.has(d.user_id));
}

type TransactionRow = {
  readonly amount: number;
  readonly category_id: string;
  readonly type: string;
};

async function fetchUserTransactions(
  userId: string,
  since: string
): Promise<readonly TransactionRow[]> {
  const { data, error } = await serviceClient
    .from("transactions")
    .select("amount, category_id, type")
    .eq("user_id", userId)
    .gte("date", since)
    .is("deleted_at", null);

  if (error) {
    console.error(`Failed to fetch transactions for ${userId}:`, error.message);
    return [];
  }

  return data ?? [];
}

type BudgetRow = {
  readonly amount: number;
  readonly category_id: string;
};

async function fetchUserBudgets(userId: string, month: string): Promise<readonly BudgetRow[]> {
  const { data, error } = await serviceClient
    .from("budgets")
    .select("amount, category_id")
    .eq("user_id", userId)
    .eq("month", month)
    .is("deleted_at", null);

  if (error) {
    console.error(`Failed to fetch budgets for ${userId}:`, error.message);
    return [];
  }

  return data ?? [];
}

async function fetchGoalContributions(userId: string, since: string): Promise<number> {
  const { data, error } = await serviceClient
    .from("goal_contributions")
    .select("amount")
    .eq("user_id", userId)
    .gte("date", since)
    .is("deleted_at", null);

  if (error) {
    console.error(`Failed to fetch goal contributions for ${userId}:`, error.message);
    return 0;
  }

  return (data ?? []).reduce((sum: number, row: { amount: number }) => sum + row.amount, 0);
}

// ---------------------------------------------------------------------------
// Digest computation
// ---------------------------------------------------------------------------

/** Group category spending totals from expense transactions. */
const computeCategoryTotals = (
  transactions: readonly TransactionRow[]
): ReadonlyMap<string, number> =>
  transactions
    .filter((tx) => tx.type === "expense")
    .reduce<Map<string, number>>((acc, tx) => {
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + tx.amount);
      return acc;
    }, new Map());

const deriveBudgetStatus = (
  budgets: readonly BudgetRow[],
  categoryTotals: ReadonlyMap<string, number>
): WeeklyDigestData["budgetStatus"] => {
  if (budgets.length === 0) return "no_budgets";

  const isOver = budgets.some((b) => (categoryTotals.get(b.category_id) ?? 0) > b.amount);
  return isOver ? "over" : "on_track";
};

async function computeDigestData(userId: string): Promise<WeeklyDigestData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sinceDate = sevenDaysAgo.toISOString().slice(0, 10); // YYYY-MM-DD

  // Current month in YYYY-MM format for budget lookup
  const currentMonth = now.toISOString().slice(0, 7);

  const [transactions, budgets, goalContributions] = await Promise.all([
    fetchUserTransactions(userId, sinceDate),
    fetchUserBudgets(userId, currentMonth),
    fetchGoalContributions(userId, sinceDate),
  ]);

  const categoryTotals = computeCategoryTotals(transactions);

  const totalSpent = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const topCategories = Array.from(categoryTotals.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([name, amount]) => ({ name, amount }));

  const budgetStatus = deriveBudgetStatus(budgets, categoryTotals);

  return {
    totalSpent,
    topCategories,
    budgetStatus,
    goalContributionsThisWeek: goalContributions,
  };
}

// ---------------------------------------------------------------------------
// Expo Push API
// ---------------------------------------------------------------------------

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function sendPushBatch(
  messages: readonly ExpoPushMessage[]
): Promise<readonly ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    console.error(`Expo Push API returned ${response.status}: ${await response.text()}`);
    return [];
  }

  const result = await response.json();
  return result.data ?? [];
}

/** Remove stale tokens that Expo reports as DeviceNotRegistered. */
async function cleanupStaleTokens(
  tickets: readonly ExpoPushTicket[],
  messages: readonly ExpoPushMessage[]
): Promise<void> {
  const staleTokens = tickets
    .map((ticket, i) => ({
      ticket,
      token: messages[i]?.to,
    }))
    .filter(
      ({ ticket }) =>
        ticket.status === "error" &&
        "details" in ticket &&
        ticket.details?.error === "DeviceNotRegistered"
    )
    .map(({ token }) => token)
    .filter((token): token is string => token !== undefined);

  if (staleTokens.length === 0) return;

  console.log(`Cleaning up ${staleTokens.length} stale push tokens`);

  const { error } = await serviceClient
    .from("push_devices")
    .delete()
    .in("expo_push_token", staleTokens);

  if (error) {
    console.error("Failed to clean up stale tokens:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  try {
    const devices = await fetchEligibleDevices();

    if (devices.length === 0) {
      console.log("No eligible devices for weekly digest");
      return jsonResponse({ success: true, sent: 0 });
    }

    // Group tokens by user
    const tokensByUser = devices.reduce<Map<string, string[]>>((acc, d) => {
      const tokens = acc.get(d.user_id) ?? [];
      tokens.push(d.expo_push_token);
      acc.set(d.user_id, tokens);
      return acc;
    }, new Map());

    const userIds = Array.from(tokensByUser.keys());
    console.log(`Computing digests for ${userIds.length} users`);

    // Compute digest for each user and build push messages
    const allMessages: ExpoPushMessage[] = [];

    for (const userId of userIds) {
      try {
        const digestData = await computeDigestData(userId);
        const { title, body } = deriveDigestMessage(digestData);
        const tokens = tokensByUser.get(userId) ?? [];

        const messages = tokens.map(
          (token): ExpoPushMessage => ({
            to: token,
            title,
            body,
            data: { route: "/notifications" },
          })
        );

        allMessages.push(...messages);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to compute digest for user ${userId}:`, message);
      }
    }

    if (allMessages.length === 0) {
      console.log("No messages to send after digest computation");
      return jsonResponse({ success: true, sent: 0 });
    }

    // Send in batches of 100 (Expo recommendation)
    const batches = chunk(allMessages, 100);
    let totalSent = 0;

    let totalFailed = 0;
    for (const batch of batches) {
      const tickets = await sendPushBatch(batch);
      if (tickets.length === 0) {
        // sendPushBatch returned [] on non-2xx — count entire batch as failed
        totalFailed += batch.length;
      } else {
        await cleanupStaleTokens(tickets, batch);
        totalSent += tickets.filter((t) => t.status === "ok").length;
        totalFailed += tickets.filter((t) => t.status === "error").length;
      }
    }

    console.log(`Weekly digest: ${totalSent} sent, ${totalFailed} failed`);
    return jsonResponse({ success: totalFailed === 0, sent: totalSent, failed: totalFailed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Weekly digest error:", message);
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
});
