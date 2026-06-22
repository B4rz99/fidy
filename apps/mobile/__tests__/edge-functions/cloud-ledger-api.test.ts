// biome-ignore-all lint/style/useNamingConvention: Cloud Ledger API payloads use snake_case fields
import { describe, expect, it, vi } from "vitest";
import { handleCloudLedgerRequest } from "../../../../supabase/functions/cloud-ledger-api/handler";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const CURSOR = "ledger:1";

type LedgerBootstrapPayload = {
  readonly cursor: string;
  readonly categories: readonly unknown[];
  readonly financialAccounts: readonly unknown[];
  readonly transactions: readonly unknown[];
  readonly tombstones: readonly unknown[];
};

const AUTHENTICATED_BOOTSTRAP_PAYLOAD: LedgerBootstrapPayload = {
  cursor: CURSOR,
  categories: [
    {
      id: "cat-groceries",
      name: "Groceries",
      icon: "basket",
      color: "#2F6F5E",
      updatedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
  financialAccounts: [
    {
      id: "acct-cash",
      name: "Cash",
      type: "cash",
      currency: "COP",
      updatedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "txn-user",
      type: "expense",
      amount: 15_000,
      currency: "COP",
      categoryId: "cat-groceries",
      accountId: "acct-cash",
      description: "Market",
      date: "2026-06-01",
      updatedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
  tombstones: [],
};

const OTHER_USER_BOOTSTRAP_PAYLOAD: LedgerBootstrapPayload = {
  cursor: "ledger:99",
  categories: [],
  financialAccounts: [],
  transactions: [
    {
      id: "txn-other-user",
      type: "income",
      amount: 99_000,
      currency: "COP",
      categoryId: null,
      accountId: "acct-other",
      description: "Private",
      date: "2026-06-02",
      updatedAt: "2026-06-02T10:00:00.000Z",
    },
  ],
  tombstones: [],
};

describe("cloud-ledger-api Edge Function", () => {
  it("answers preflight requests with allowed Remote API Boundary methods", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(optionsRequest(), api.deps);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(api.store.bootstrapLedger).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated bootstrap requests with typed failures before ledger access", async () => {
    const missingAuth = createCloudLedgerApiDeps();
    const missingAuthResponse = await handleCloudLedgerRequest(
      jsonRequest({ action: "bootstrap" }),
      missingAuth.deps
    );

    expect(missingAuthResponse.status).toBe(401);
    await expect(missingAuthResponse.json()).resolves.toEqual({
      success: false,
      error: "missing_auth",
    });
    expect(missingAuth.store.bootstrapLedger).not.toHaveBeenCalled();

    const invalidAuth = createCloudLedgerApiDeps({ authError: { message: "bad token" } });
    const invalidAuthResponse = await handleCloudLedgerRequest(
      jsonRequest({ action: "bootstrap" }, "invalid-token"),
      invalidAuth.deps
    );

    expect(invalidAuthResponse.status).toBe(401);
    await expect(invalidAuthResponse.json()).resolves.toEqual({
      success: false,
      error: "invalid_auth",
    });
    expect(invalidAuth.store.bootstrapLedger).not.toHaveBeenCalled();
  });

  it("bootstraps ledger data for the authenticated user and ignores body ownership", async () => {
    const api = createCloudLedgerApiDeps({
      bootstrapByUserId: new Map([
        [USER_ID, AUTHENTICATED_BOOTSTRAP_PAYLOAD],
        [OTHER_USER_ID, OTHER_USER_BOOTSTRAP_PAYLOAD],
      ]),
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest({ action: "bootstrap", userId: OTHER_USER_ID }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: AUTHENTICATED_BOOTSTRAP_PAYLOAD,
    });
    expect(api.store.bootstrapLedger).toHaveBeenCalledWith(USER_ID, null);
  });

  it("refreshes from a Ledger Cursor through the authenticated API boundary", async () => {
    const api = createCloudLedgerApiDeps({
      bootstrapByUserId: new Map([
        [
          USER_ID,
          {
            cursor: "ledger:2",
            categories: [],
            financialAccounts: [],
            transactions: [],
            tombstones: [],
          },
        ],
      ]),
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest({ action: "refresh", cursor: CURSOR }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        cursor: "ledger:2",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [],
      },
    });
    expect(api.store.bootstrapLedger).toHaveBeenCalledWith(USER_ID, CURSOR);
  });

  it("rejects refresh requests without a Ledger Cursor before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest({ action: "refresh" }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_cursor",
    });
    expect(api.store.bootstrapLedger).not.toHaveBeenCalled();
  });

  it("rejects invalid Ledger Cursors with typed failures before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest({ action: "refresh", cursor: "not-a-ledger-cursor" }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_cursor",
    });
    expect(api.store.bootstrapLedger).not.toHaveBeenCalled();
  });
});

function optionsRequest() {
  return new Request("http://localhost/cloud-ledger-api", { method: "OPTIONS" });
}

function jsonRequest(body: unknown, token?: string) {
  return new Request("http://localhost/cloud-ledger-api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

function createCloudLedgerApiDeps(
  options: {
    readonly authError?: { readonly message: string };
    readonly bootstrapByUserId?: ReadonlyMap<string, LedgerBootstrapPayload>;
    readonly userId?: string;
  } = {}
) {
  const bootstrapByUserId = options.bootstrapByUserId ?? new Map();
  const store = {
    bootstrapLedger: vi.fn<(...args: any[]) => any>((userId: string) =>
      Promise.resolve(
        bootstrapByUserId.get(userId) ?? {
          cursor: CURSOR,
          categories: [],
          financialAccounts: [],
          transactions: [],
          tombstones: [],
        }
      )
    ),
  };

  return {
    store,
    deps: {
      auth: {
        auth: {
          getUser: vi.fn<(...args: any[]) => any>(() =>
            Promise.resolve({
              data: {
                user: options.authError === undefined ? { id: options.userId ?? USER_ID } : null,
              },
              error: options.authError ?? null,
            })
          ),
        },
      },
      store,
    },
  };
}
