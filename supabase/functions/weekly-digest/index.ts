// biome-ignore-all lint/style/useNamingConvention: Supabase column names and Expo Push API fields
// Weekly Digest Edge Function - cron reminder
//
// Default financial digest content is generated from the Local Ledger on device.
// This server-side cron only honors push-device eligibility and weekly_digest
// preferences, then sends a privacy-preserving reminder.

import { createClient } from "npm:@supabase/supabase-js@2";

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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
  readonly data: { readonly route: string; readonly type: string };
};

type ExpoPushTicket =
  | { readonly status: "ok"; readonly id: string }
  | {
      readonly status: "error";
      readonly message: string;
      readonly details?: { readonly error: string };
    };

type UserDevice = {
  readonly user_id: string;
  readonly expo_push_token: string;
};

const chunk = <T>(items: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );

const toDigestReminder = (device: UserDevice): ExpoPushMessage => ({
  to: device.expo_push_token,
  title: "Your weekly digest is ready",
  body: "Open Fidy to generate it privately from this device.",
  data: { route: "/notifications", type: "weekly_digest" },
});

function logWeeklyDigestError(message: string, detail?: unknown): void {
  // eslint-disable-next-line no-console -- Supabase Edge Function operational error log.
  console.error(message, detail);
}

function logWeeklyDigestInfo(message: string): void {
  // eslint-disable-next-line no-console -- Supabase Edge Function operational status log.
  console.log(message);
}

async function fetchEligibleDevices(): Promise<readonly UserDevice[]> {
  const { data: devices, error: devError } = await serviceClient
    .from("push_devices")
    .select("user_id, expo_push_token, updated_at")
    .order("updated_at", { ascending: false });

  if (devError) {
    logWeeklyDigestError("Failed to fetch push devices:", devError.message);
    return [];
  }

  if (!devices || devices.length === 0) return [];

  const { data: optedOut, error: prefError } = await serviceClient
    .from("notification_preferences")
    .select("user_id")
    .eq("weekly_digest", false);

  if (prefError) {
    logWeeklyDigestError("Failed to fetch digest preferences:", prefError.message);
    return [];
  }

  const seenTokens = new Set<string>();
  const latestPerToken = devices.filter((device: UserDevice) => {
    if (seenTokens.has(device.expo_push_token)) return false;
    seenTokens.add(device.expo_push_token);
    return true;
  });

  const optedOutIds = new Set((optedOut ?? []).map((row: { user_id: string }) => row.user_id));
  return latestPerToken.filter((device: UserDevice) => !optedOutIds.has(device.user_id));
}

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
    logWeeklyDigestError(`Expo Push API returned ${response.status}: ${await response.text()}`);
    return [];
  }

  const result = await response.json();
  return result.data ?? [];
}

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

  const { error } = await serviceClient
    .from("push_devices")
    .delete()
    .in("expo_push_token", staleTokens);

  if (error) {
    logWeeklyDigestError("Failed to clean up stale tokens:", error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return jsonResponse({ success: false, error: "unauthorized" }, 401);
  }

  try {
    const devices = await fetchEligibleDevices();

    if (devices.length === 0) {
      logWeeklyDigestInfo("No eligible devices for weekly digest");
      return jsonResponse({ success: true, sent: 0 });
    }

    const allMessages = devices.map(toDigestReminder);
    const batches = chunk(allMessages, 100);
    const totals = { sent: 0, failed: 0 };

    for (const batch of batches) {
      const tickets = await sendPushBatch(batch);
      if (tickets.length === 0) {
        totals.failed += batch.length;
      } else {
        await cleanupStaleTokens(tickets, batch);
        totals.sent += tickets.filter((ticket) => ticket.status === "ok").length;
        totals.failed += tickets.filter((ticket) => ticket.status === "error").length;
      }
    }

    logWeeklyDigestInfo(`Weekly digest reminders: ${totals.sent} sent, ${totals.failed} failed`);
    return jsonResponse({
      success: totals.failed === 0,
      sent: totals.sent,
      failed: totals.failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWeeklyDigestError("Weekly digest reminder error:", message);
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
});
