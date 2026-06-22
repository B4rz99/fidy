import type { CloudLedgerApiResponse, CloudLedgerBootstrapPayload, LedgerCursor } from "./model.ts";
import { isLedgerCursor } from "./model.ts";

type SupabaseError = { readonly message?: string } | null;

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
  if (action === "bootstrap" || action === "refresh") {
    const cursor = readOptionalCursor(body);
    if (cursor === undefined) {
      return jsonResponse({ success: false, error: "invalid_cursor" }, 400);
    }

    return jsonResponse({
      success: true,
      data: await store.bootstrapLedger(userId, cursor),
    });
  }

  return jsonResponse({ success: false, error: "unsupported_action" }, 400);
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
    "Access-Control-Allow-Origin": "*",
  };
}
