// biome-ignore-all lint/style/useNamingConvention: Cloud Ledger API payloads use snake_case fields
import { describe, expect, it, vi } from "vitest";
import { handleCloudLedgerRequest } from "../../../../supabase/functions/cloud-ledger-api/handler";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const CURSOR = "ledger:1";
const CLIENT_TRANSACTION_ID = "txn-20260622-client";
const CREATE_TRANSACTION_PAYLOAD = {
  id: CLIENT_TRANSACTION_ID,
  type: "expense",
  amount: 15_000,
  currency: "COP",
  categoryId: "cat-groceries",
  accountId: "acct-cash",
  description: "Market",
  date: "2026-06-01",
} as const;
const CREATE_TRANSACTION_COMMAND = {
  commandVersion: 1,
  transaction: CREATE_TRANSACTION_PAYLOAD,
} as const;
const CREATE_TRANSACTION_REQUEST_BODY = {
  action: "createTransaction",
  commandVersion: 1,
  userId: OTHER_USER_ID,
  transaction: CREATE_TRANSACTION_PAYLOAD,
} as const;
const ACCEPTED_CREATE_TRANSACTION_OUTCOME = {
  code: "accepted",
  transaction: {
    ...CREATE_TRANSACTION_PAYLOAD,
    updatedAt: "2026-06-01T10:02:00.000Z",
  },
  cursor: "ledger:2",
} as const;
const CAPTURE_IMPROVEMENT_SAMPLE = {
  sourceChannel: "email",
  sourceFamily: "email",
  providerCategory: "bank",
  templateShape: "Compra por [AMOUNT] en [MERCHANT] con tarjeta [CARD].",
  parseOutcome: "failed",
  confidenceBucket: "none",
  extractor: {
    method: "regex",
    version: 1,
  },
} as const;

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

  it("creates a transaction for the authenticated user and preserves the client transaction id", async () => {
    const api = createCloudLedgerApiDeps({
      createTransactionResult: ACCEPTED_CREATE_TRANSACTION_OUTCOME,
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(CREATE_TRANSACTION_REQUEST_BODY, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: ACCEPTED_CREATE_TRANSACTION_OUTCOME,
    });
    expect(api.store.createTransaction).toHaveBeenCalledWith(USER_ID, CREATE_TRANSACTION_COMMAND);
  });

  it("retains Capture Improvement Samples for the authenticated account only", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          userId: OTHER_USER_ID,
          sample: CAPTURE_IMPROVEMENT_SAMPLE,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { code: "accepted" },
    });
    expect(api.store.retainCaptureImprovementSample).toHaveBeenCalledWith(
      USER_ID,
      CAPTURE_IMPROVEMENT_SAMPLE
    );
  });

  it("rejects Capture Improvement Sample retention when the account has opted out", async () => {
    const api = createCloudLedgerApiDeps({
      retainCaptureImprovementResult: { code: "capture_improvement_opted_out" },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: CAPTURE_IMPROVEMENT_SAMPLE,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "capture_improvement_opted_out",
    });
    expect(api.store.retainCaptureImprovementSample).toHaveBeenCalledWith(
      USER_ID,
      CAPTURE_IMPROVEMENT_SAMPLE
    );
  });

  it("updates Capture Improvement Preference for the authenticated account only", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "setCaptureImprovementPreference",
          userId: OTHER_USER_ID,
          enabled: true,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { code: "accepted" },
    });
    expect(api.store.setCaptureImprovementPreference).toHaveBeenCalledWith(USER_ID, true);
  });

  it("rejects raw capture content in the top-level Capture Improvement Preference envelope", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "setCaptureImprovementPreference",
          enabled: false,
          rawText: "Compra por $50,000 en EXITO. Ref ABC123XYZ. user@example.com",
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_capture_improvement_sample",
    });
    expect(api.store.setCaptureImprovementPreference).not.toHaveBeenCalled();
  });

  it("rejects unsafe Capture Improvement Samples before remote retention", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            templateShape:
              "Compra por 50000 en EXITO con tarjeta *1234. Ref 12345678901 user@example.com",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unsafe_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("rejects lowercase merchant and location residue in Capture Improvement Samples", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            templateShape: "compra en exito cerca de bogota por [AMOUNT]",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unsafe_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("rejects colon-labeled lowercase entities in Capture Improvement Samples", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            templateShape: "Comercio: exito por [AMOUNT]. Beneficiario: juan perez.",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unsafe_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("rejects alphanumeric reference values in Capture Improvement Samples", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            templateShape: "Referencia ABC123XYZ por [AMOUNT].",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unsafe_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("rejects unlabeled alphanumeric reference values in Capture Improvement Samples", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            templateShape: "ABC123XYZ Compra por [AMOUNT] en [MERCHANT].",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unsafe_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("accepts structural authorization reference placeholders in Capture Improvement Samples", async () => {
    const api = createCloudLedgerApiDeps();
    const sample = {
      ...CAPTURE_IMPROVEMENT_SAMPLE,
      templateShape: "Autorizacion [REFERENCE] por [AMOUNT].",
    };

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { code: "accepted" },
    });
    expect(api.store.retainCaptureImprovementSample).toHaveBeenCalledWith(USER_ID, sample);
  });

  it("rejects unlabeled lowercase merchant or person tokens in Capture Improvement Samples", async () => {
    const samples = [
      "exito compra por [AMOUNT].",
      "juan perez pago por [AMOUNT].",
      "rappi retiro por [AMOUNT].",
    ];

    for (const templateShape of samples) {
      const api = createCloudLedgerApiDeps();
      const response = await handleCloudLedgerRequest(
        jsonRequest(
          {
            action: "retainCaptureImprovementSample",
            sample: {
              ...CAPTURE_IMPROVEMENT_SAMPLE,
              templateShape,
            },
          },
          "valid-token"
        ),
        api.deps
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "unsafe_capture_improvement_sample",
      });
      expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
    }
  });

  it("rejects Capture Improvement Samples with disallowed raw fields", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            rawText: "Compra por $50,000 en EXITO",
            senderDomain: "davibank.com",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("rejects raw capture content in the top-level Capture Improvement Sample envelope", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          rawText: "Compra por $50,000 en EXITO. Ref ABC123XYZ. user@example.com",
          sample: CAPTURE_IMPROVEMENT_SAMPLE,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("deletes user-linked Capture Improvement Samples for the authenticated account", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "deleteCaptureImprovementSamples",
          userId: OTHER_USER_ID,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { code: "accepted" },
    });
    expect(api.store.deleteCaptureImprovementSamples).toHaveBeenCalledWith(USER_ID);
  });

  it("rejects raw capture content in the top-level Capture Improvement deletion envelope", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "deleteCaptureImprovementSamples",
          rawText: "Compra por $50,000 en EXITO. Ref ABC123XYZ. user@example.com",
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_capture_improvement_sample",
    });
    expect(api.store.deleteCaptureImprovementSamples).not.toHaveBeenCalled();
  });

  it("rejects invalid client transaction ids with typed failures before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 1,
          transaction: {
            id: "   ",
            type: "expense",
            amount: 15_000,
            currency: "COP",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "Market",
            date: "2026-06-01",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_transaction_id",
    });
    expect(api.store.createTransaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported create command versions with typed failures before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 2,
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "expense",
            amount: 15_000,
            currency: "COP",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "Market",
            date: "2026-06-01",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unsupported_command_version",
    });
    expect(api.store.createTransaction).not.toHaveBeenCalled();
  });

  it("rejects malformed create transaction fields with typed failures before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 1,
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "transfer",
            amount: 15_000,
            currency: "USD",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "Market",
            date: "2026-06-01",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_transaction",
    });
    expect(api.store.createTransaction).not.toHaveBeenCalled();
  });

  it("rejects overlong create transaction descriptions before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 1,
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "expense",
            amount: 15_000,
            currency: "COP",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "x".repeat(201),
            date: "2026-06-01",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_transaction",
    });
    expect(api.store.createTransaction).not.toHaveBeenCalled();
  });

  it("rejects malformed create transaction dates with typed failures before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 1,
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "expense",
            amount: 15_000,
            currency: "COP",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "Market",
            date: "not-a-date",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_transaction",
    });
    expect(api.store.createTransaction).not.toHaveBeenCalled();
  });

  it("rejects unsafe create transaction amounts with typed failures before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 1,
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "expense",
            amount: 2_147_483_648,
            currency: "COP",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "Market",
            date: "2026-06-01",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_transaction",
    });
    expect(api.store.createTransaction).not.toHaveBeenCalled();
  });

  it("rejects missing create transaction payloads with typed failures before ledger access", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 1,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_transaction",
    });
    expect(api.store.createTransaction).not.toHaveBeenCalled();
  });

  it("maps unauthorized client transaction id outcomes to typed API failures", async () => {
    const api = createCloudLedgerApiDeps({
      createTransactionResult: { code: "unauthorized_transaction_id" },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "createTransaction",
          commandVersion: 1,
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "expense",
            amount: 15_000,
            currency: "COP",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "Market",
            date: "2026-06-01",
          },
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unauthorized_transaction_id",
    });
    expect(api.store.createTransaction).toHaveBeenCalledWith(USER_ID, CREATE_TRANSACTION_COMMAND);
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
    readonly createTransactionResult?: unknown;
    readonly retainCaptureImprovementResult?: unknown;
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
    createTransaction: vi.fn<(...args: any[]) => any>(() =>
      Promise.resolve(
        options.createTransactionResult ?? {
          code: "accepted",
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "expense",
            amount: 15_000,
            currency: "COP",
            categoryId: null,
            accountId: "acct-cash",
            description: null,
            date: "2026-06-01",
            updatedAt: "2026-06-01T10:02:00.000Z",
          },
          cursor: "ledger:2",
        }
      )
    ),
    retainCaptureImprovementSample: vi.fn<(...args: any[]) => any>(() =>
      Promise.resolve(options.retainCaptureImprovementResult ?? { code: "accepted" })
    ),
    deleteCaptureImprovementSamples: vi.fn<(...args: any[]) => any>(() =>
      Promise.resolve({ code: "accepted" })
    ),
    setCaptureImprovementPreference: vi.fn<(...args: any[]) => any>(() =>
      Promise.resolve({ code: "accepted" })
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
