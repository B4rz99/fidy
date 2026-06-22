import type {
  CloudLedgerApiResponse,
  CloudLedgerBootstrapPayload,
  CloudLedgerCreateTransactionCommand,
  CloudLedgerCreateTransactionOutcome,
  CloudLedgerCreateTransactionRejected,
  LedgerCursor,
} from "./model.ts";
import type { SupabaseError } from "../_shared/supabase-error.ts";
import {
  readCreateTransactionCommand,
  type CreateTransactionCommandReadResult,
} from "./create-transaction-command.ts";
import { isLedgerCursor } from "./model.ts";

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
};

export type CloudLedgerApiDeps = {
  readonly auth: AuthClient;
  readonly store: LedgerStore;
};

export async function handleCloudLedgerRequest(
  request: Request,
  deps: CloudLedgerApiDeps
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === null) {
    return jsonResponse({ success: false, error: "missing_auth" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await deps.auth.auth.getUser(token);

  if (error !== null || user === null) {
    return jsonResponse({ success: false, error: "invalid_auth" }, 401);
  }

  const body = await readJsonBody(request);
  try {
    return await routeAuthenticatedRequest(deps.store, user.id, body);
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
  if (commandResult.kind === "invalid_command") {
    return jsonResponse({ success: false, error: "unsupported_action" }, 400);
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

function createTransactionFailureStatus(outcome: CloudLedgerCreateTransactionRejected) {
  return outcome.code === "unauthorized_transaction_id" ? 403 : 400;
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

function readRequiredString(body: unknown, key: string): string | null {
  if (body === null || typeof body !== "object" || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
