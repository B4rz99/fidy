import type {
  CaptureImprovementSample,
  CaptureImprovementSampleAccepted,
  CaptureImprovementSampleOutcome,
  CloudLedgerApiResponse,
  CloudLedgerBootstrapPayload,
  CloudLedgerCreateTransactionCommand,
  CloudLedgerCreateTransactionOutcome,
  CloudLedgerCreateTransactionRejected,
  LedgerCursor,
} from "./model.ts";
import type {
  CloudLedgerApplyPendingChangesCommand,
  CloudLedgerApplyPendingChangesOutcome,
} from "./pending-change-set-model.ts";
import type { SupabaseError } from "../_shared/supabase-error.ts";
import { readCaptureImprovementSample } from "./capture-improvement-sample.ts";
import {
  readApplyPendingChangesCommand,
  type ApplyPendingChangesCommandReadResult,
} from "./apply-pending-changes-command.ts";
import {
  readCreateTransactionCommand,
  type CreateTransactionCommandReadResult,
} from "./create-transaction-command.ts";
import { isLedgerCursor } from "./model.ts";
import { readRequiredString } from "./request-readers.ts";
import { recordCloudLedgerCommandTelemetry, type CloudLedgerTelemetry } from "./telemetry.ts";

type AuthClient = {
  readonly auth: {
    getUser(token: string): Promise<{
      readonly data: { readonly user: { readonly id: string } | null };
      readonly error: SupabaseError;
    }>;
  };
};

type LedgerStore = {
  bootstrapLedger(
    userId: string,
    cursor: LedgerCursor | null
  ): Promise<CloudLedgerBootstrapPayload>;
  createTransaction(
    userId: string,
    command: CloudLedgerCreateTransactionCommand
  ): Promise<CloudLedgerCreateTransactionOutcome>;
  applyPendingChanges(
    userId: string,
    command: CloudLedgerApplyPendingChangesCommand
  ): Promise<CloudLedgerApplyPendingChangesOutcome>;
  retainCaptureImprovementSample(
    userId: string,
    sample: CaptureImprovementSample
  ): Promise<CaptureImprovementSampleOutcome>;
  deleteCaptureImprovementSamples(userId: string): Promise<CaptureImprovementSampleAccepted>;
  setCaptureImprovementPreference(
    userId: string,
    enabled: boolean
  ): Promise<CaptureImprovementSampleAccepted>;
};

const RETAIN_CAPTURE_IMPROVEMENT_SAMPLE_KEYS = new Set(["action", "sample", "userId"]);
const DELETE_CAPTURE_IMPROVEMENT_SAMPLES_KEYS = new Set(["action", "userId"]);
const SET_CAPTURE_IMPROVEMENT_PREFERENCE_KEYS = new Set(["action", "enabled", "userId"]);
const SAFE_CORRELATION_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

export type CloudLedgerApiDeps = {
  readonly auth: AuthClient;
  readonly store: LedgerStore;
  readonly telemetry?: CloudLedgerTelemetry;
  readonly now?: () => number;
  readonly createCorrelationId?: () => string;
};

export async function handleCloudLedgerRequest(
  request: Request,
  deps: CloudLedgerApiDeps
): Promise<Response> {
  const startedAt = readNow(deps);
  const correlationId = readCorrelationId(deps);
  if (request.method === "OPTIONS") {
    return withCorrelationId(
      new Response(null, { status: 204, headers: corsHeaders() }),
      correlationId
    );
  }
  if (request.method !== "POST") {
    return withCorrelationId(
      jsonResponse({ success: false, error: "method_not_allowed" }, 405),
      correlationId
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === null) {
    return withCorrelationId(
      jsonResponse({ success: false, error: "missing_auth" }, 401),
      correlationId
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await deps.auth.auth.getUser(token);

  if (error !== null || user === null) {
    return withCorrelationId(
      jsonResponse({ success: false, error: "invalid_auth" }, 401),
      correlationId
    );
  }

  const body = await readJsonBody(request);
  const response = await routeAuthenticatedRequestSafely(deps.store, user.id, body);
  await recordCloudLedgerCommandTelemetry({
    authenticatedUserId: user.id,
    body,
    correlationId,
    now: () => readNow(deps),
    response,
    startedAt,
    telemetry: deps.telemetry,
  });
  return withCorrelationId(response, correlationId);
}

async function routeAuthenticatedRequestSafely(store: LedgerStore, userId: string, body: unknown) {
  try {
    return await routeAuthenticatedRequest(store, userId, body);
  } catch {
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
}

async function routeAuthenticatedRequest(store: LedgerStore, userId: string, body: unknown) {
  const action = readAction(body);
  if (action === "bootstrap") {
    return bootstrapResponse(store, userId, readOptionalCursor(body));
  }
  if (action === "refresh") {
    return refreshResponse(store, userId, readOptionalCursor(body));
  }
  if (action === "createTransaction") {
    return createTransactionResponse(store, userId, readCreateTransactionCommand(body));
  }
  if (action === "applyPendingChanges") {
    return applyPendingChangesResponse(store, userId, readApplyPendingChangesCommand(body));
  }
  if (action === "retainCaptureImprovementSample") {
    if (!hasOnlyAllowedKeys(body, RETAIN_CAPTURE_IMPROVEMENT_SAMPLE_KEYS)) {
      return jsonResponse({ success: false, error: "invalid_capture_improvement_sample" }, 400);
    }
    return retainCaptureImprovementSampleResponse(
      store,
      userId,
      readCaptureImprovementSample(body)
    );
  }
  if (action === "deleteCaptureImprovementSamples") {
    if (!hasOnlyAllowedKeys(body, DELETE_CAPTURE_IMPROVEMENT_SAMPLES_KEYS)) {
      return jsonResponse({ success: false, error: "invalid_capture_improvement_sample" }, 400);
    }
    return deleteCaptureImprovementSamplesResponse(store, userId);
  }
  if (action === "setCaptureImprovementPreference") {
    if (!hasOnlyAllowedKeys(body, SET_CAPTURE_IMPROVEMENT_PREFERENCE_KEYS)) {
      return jsonResponse({ success: false, error: "invalid_capture_improvement_sample" }, 400);
    }
    return setCaptureImprovementPreferenceResponse(store, userId, readBoolean(body, "enabled"));
  }

  return jsonResponse({ success: false, error: "unsupported_action" }, 400);
}

async function bootstrapResponse(
  store: LedgerStore,
  userId: string,
  cursor: LedgerCursor | null | undefined
) {
  if (cursor === undefined) {
    return jsonResponse({ success: false, error: "invalid_cursor" }, 400);
  }
  return jsonResponse({
    success: true,
    data: await store.bootstrapLedger(userId, cursor),
  });
}

async function createTransactionResponse(
  store: LedgerStore,
  userId: string,
  commandResult: CreateTransactionCommandReadResult
) {
  if (commandResult.kind === "invalid_transaction_id") {
    return jsonResponse({ success: false, error: "invalid_transaction_id" }, 400);
  }
  if (commandResult.kind === "invalid_ledger_reference") {
    return jsonResponse({ success: false, error: "invalid_ledger_reference" }, 400);
  }
  if (commandResult.kind === "invalid_transaction") {
    return jsonResponse({ success: false, error: "invalid_transaction" }, 400);
  }
  if (commandResult.kind === "unsupported_command_version") {
    return jsonResponse({ success: false, error: "unsupported_command_version" }, 400);
  }
  const outcome = await store.createTransaction(userId, commandResult.command);
  if (outcome.code !== "accepted") {
    return jsonResponse(
      { success: false, error: outcome.code },
      createTransactionFailureStatus(outcome)
    );
  }
  return jsonResponse({
    success: true,
    data: outcome,
  });
}

async function applyPendingChangesResponse(
  store: LedgerStore,
  userId: string,
  commandResult: ApplyPendingChangesCommandReadResult
) {
  if (commandResult.kind === "invalid_pending_change") {
    return jsonResponse({ success: false, error: "invalid_transaction" }, 400);
  }
  if (commandResult.kind === "invalid_transaction_id") {
    return jsonResponse({ success: false, error: "invalid_transaction_id" }, 400);
  }
  if (commandResult.kind === "invalid_ledger_reference") {
    return jsonResponse({ success: false, error: "invalid_ledger_reference" }, 400);
  }
  if (commandResult.kind === "invalid_transaction") {
    return jsonResponse({ success: false, error: "invalid_transaction" }, 400);
  }
  if (commandResult.kind === "pending_change_batch_too_large") {
    return jsonResponse({ success: false, error: "pending_change_batch_too_large" }, 413);
  }
  if (commandResult.kind === "unsupported_command_version") {
    return jsonResponse({ success: false, error: "unsupported_command_version" }, 400);
  }
  const outcome = await store.applyPendingChanges(userId, commandResult.command);
  return jsonResponse({
    success: true,
    data: outcome,
  });
}

function createTransactionFailureStatus(outcome: CloudLedgerCreateTransactionRejected) {
  return outcome.code === "unauthorized_transaction_id" ? 403 : 400;
}

async function retainCaptureImprovementSampleResponse(
  store: LedgerStore,
  userId: string,
  sampleResult: ReturnType<typeof readCaptureImprovementSample>
) {
  if (sampleResult.kind === "invalid") {
    return jsonResponse({ success: false, error: "invalid_capture_improvement_sample" }, 400);
  }
  if (sampleResult.kind === "unsafe") {
    return jsonResponse({ success: false, error: "unsafe_capture_improvement_sample" }, 400);
  }
  const outcome = await store.retainCaptureImprovementSample(userId, sampleResult.sample);
  if (outcome.code === "capture_improvement_opted_out") {
    return jsonResponse({ success: false, error: "capture_improvement_opted_out" }, 403);
  }
  if (outcome.code !== "accepted") {
    return jsonResponse({ success: false, error: outcome.code }, 400);
  }
  return jsonResponse({
    success: true,
    data: outcome,
  });
}

async function deleteCaptureImprovementSamplesResponse(store: LedgerStore, userId: string) {
  return jsonResponse({
    success: true,
    data: await store.deleteCaptureImprovementSamples(userId),
  });
}

async function setCaptureImprovementPreferenceResponse(
  store: LedgerStore,
  userId: string,
  enabled: boolean | null
) {
  if (enabled === null) {
    return jsonResponse({ success: false, error: "invalid_capture_improvement_sample" }, 400);
  }
  return jsonResponse({
    success: true,
    data: await store.setCaptureImprovementPreference(userId, enabled),
  });
}

async function refreshResponse(
  store: LedgerStore,
  userId: string,
  cursor: LedgerCursor | null | undefined
) {
  if (cursor === null || cursor === undefined) {
    return jsonResponse({ success: false, error: "invalid_cursor" }, 400);
  }
  return jsonResponse({
    success: true,
    data: await store.bootstrapLedger(userId, cursor),
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readAction(body: unknown) {
  return readRequiredString(body, "action");
}

function readBoolean(body: unknown, key: string): boolean | null {
  if (body === null || typeof body !== "object") {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function hasOnlyAllowedKeys(body: unknown, allowedKeys: ReadonlySet<string>): boolean {
  return (
    body !== null &&
    typeof body === "object" &&
    Object.keys(body as Record<string, unknown>).every((key) => allowedKeys.has(key))
  );
}

function readOptionalCursor(body: unknown): LedgerCursor | null | undefined {
  if (body === null || typeof body !== "object" || !("cursor" in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>).cursor;
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "string" && isLedgerCursor(value.trim()) ? value.trim() : undefined;
}

function readNow(deps: CloudLedgerApiDeps): number {
  return deps.now?.() ?? Date.now();
}

function readCorrelationId(deps: CloudLedgerApiDeps): string {
  return readSafeCorrelationId(deps.createCorrelationId?.()) ?? crypto.randomUUID();
}

function readSafeCorrelationId(value: unknown): string | null {
  return typeof value === "string" && SAFE_CORRELATION_ID_PATTERN.test(value.trim())
    ? value.trim()
    : null;
}

function withCorrelationId(response: Response, correlationId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Correlation-Id", correlationId);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function jsonResponse(body: CloudLedgerApiResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };
}
