// biome-ignore-all lint/style/useNamingConvention: Cloud Ledger API payloads use snake_case fields
import { describe, expect, it, vi } from "vitest";
import { handleCloudLedgerRequest } from "../../../../supabase/functions/cloud-ledger-api/handler";
import { CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT } from "../../../../supabase/functions/cloud-ledger-api/model";

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
const PENDING_CHANGE_EXPECTED_VERSION = {
  recordType: "transaction",
  recordId: "txn-existing-versioned",
  version: 3,
} as const;
const PENDING_CHANGE_REQUEST = {
  id: "change-offline-coffee",
  kind: "createTransaction",
  commandVersion: 1,
  idempotencyKey: "idem-offline-coffee",
  dependencies: [],
  expectedVersions: [PENDING_CHANGE_EXPECTED_VERSION],
  clientTimestamp: "2026-06-01T10:02:00.000Z",
  transaction: CREATE_TRANSACTION_PAYLOAD,
} as const;
const LEGACY_V1_PENDING_CHANGE_REQUEST = {
  id: "change-legacy-v1",
  kind: "createTransaction",
  commandVersion: 1,
  transaction: {
    ...CREATE_TRANSACTION_PAYLOAD,
    id: "txn-legacy-v1",
  },
} as const;
const LEGACY_V1_NORMALIZED_PENDING_CHANGE_REQUEST = {
  ...LEGACY_V1_PENDING_CHANGE_REQUEST,
  idempotencyKey: "change-legacy-v1",
  dependencies: [],
  expectedVersions: [],
  clientTimestamp: "1970-01-01T00:00:00.000Z",
} as const;
const LEGACY_V1_ACCEPTED_PENDING_CHANGES_RESULT = {
  code: "accepted",
  acceptedChangeIds: ["change-legacy-v1", "change-offline-coffee"],
  rejectedChangeIds: [],
  changeOutcomes: [
    {
      changeId: "change-legacy-v1",
      status: "accepted",
      code: "accepted",
    },
    {
      changeId: "change-offline-coffee",
      status: "accepted",
      code: "accepted",
    },
  ],
  cursor: "ledger:2",
} as const;
const LEGACY_V1_APPLY_PENDING_CHANGES_BODY = {
  action: "applyPendingChanges",
  commandVersion: 1,
  changes: [LEGACY_V1_PENDING_CHANGE_REQUEST, PENDING_CHANGE_REQUEST],
} as const;
const UNSUPPORTED_PENDING_CHANGE_REQUEST = {
  ...PENDING_CHANGE_REQUEST,
  id: "change-old-app-version",
  commandVersion: 0,
  idempotencyKey: "idem-old-app-version",
} as const;
const APPLY_PENDING_CHANGES_REQUEST_BODY = {
  action: "applyPendingChanges",
  commandVersion: 1,
  userId: OTHER_USER_ID,
  deviceId: "device-ios-17-pro",
  batchId: "batch-20260601-offline",
  changes: [PENDING_CHANGE_REQUEST],
} as const;
const APPLY_PENDING_CHANGES_COMMAND = {
  commandVersion: 1,
  deviceId: "device-ios-17-pro",
  batchId: "batch-20260601-offline",
  changes: [PENDING_CHANGE_REQUEST],
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
  sourceProvider: "gmail",
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

  it("applies a Pending Change Set envelope through the authenticated boundary", async () => {
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: [],
        cursor: "ledger:2",
      },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(APPLY_PENDING_CHANGES_REQUEST_BODY, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: [],
        cursor: "ledger:2",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(
      USER_ID,
      APPLY_PENDING_CHANGES_COMMAND
    );
  });

  it("rejects oversized pending-change batches before replaying them", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "applyPendingChanges",
          commandVersion: 1,
          deviceId: "device-ios-17-pro",
          batchId: "batch-oversized",
          changes: Array.from({ length: CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT + 1 }, (_, index) =>
            pendingChangeRequest(index)
          ),
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "pending_change_batch_too_large",
    });
    expect(api.store.applyPendingChanges).not.toHaveBeenCalled();
  });

  it("reports permanent pending-change rejections without failing the whole batch", async () => {
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-offline-coffee"],
        cursor: "ledger:2",
      },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(APPLY_PENDING_CHANGES_REQUEST_BODY, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-offline-coffee"],
        cursor: "ledger:2",
      },
    });
  });

  it("accepts legacy v1 pending-change envelopes without new metadata", async () => {
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: LEGACY_V1_ACCEPTED_PENDING_CHANGES_RESULT,
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(LEGACY_V1_APPLY_PENDING_CHANGES_BODY, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: LEGACY_V1_ACCEPTED_PENDING_CHANGES_RESULT,
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      commandVersion: 1,
      deviceId: "device-legacy-v1",
      batchId: "batch-legacy-v1",
      changes: [LEGACY_V1_NORMALIZED_PENDING_CHANGE_REQUEST, PENDING_CHANGE_REQUEST],
    });
  });

  it("returns typed outcomes for duplicate pending change ids in a batch", async () => {
    const duplicateChange = {
      ...PENDING_CHANGE_REQUEST,
      idempotencyKey: "idem-offline-coffee-duplicate",
      transaction: {
        ...CREATE_TRANSACTION_PAYLOAD,
        id: "txn-api-duplicate-change",
      },
    } as const;
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-offline-coffee"],
        changeOutcomes: [
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
          {
            changeId: "change-offline-coffee",
            status: "repair_required",
            code: "duplicate_change_id",
          },
        ],
        cursor: "ledger:2",
      },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          ...APPLY_PENDING_CHANGES_REQUEST_BODY,
          changes: [PENDING_CHANGE_REQUEST, duplicateChange],
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-offline-coffee"],
        changeOutcomes: [
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
          {
            changeId: "change-offline-coffee",
            status: "repair_required",
            code: "duplicate_change_id",
          },
        ],
        cursor: "ledger:2",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      ...APPLY_PENDING_CHANGES_COMMAND,
      changes: [PENDING_CHANGE_REQUEST, duplicateChange],
    });
  });

  it("keeps independent invalid pending changes inside the typed batch outcome path", async () => {
    const invalidPendingChange = {
      ...PENDING_CHANGE_REQUEST,
      id: "change-invalid-amount",
      idempotencyKey: "idem-invalid-amount",
      transaction: {
        ...CREATE_TRANSACTION_PAYLOAD,
        id: "txn-invalid-amount",
        amount: 0,
      },
    } as const;
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-invalid-amount"],
        changeOutcomes: [
          {
            changeId: "change-invalid-amount",
            status: "repair_required",
            code: "invalid_transaction",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          ...APPLY_PENDING_CHANGES_REQUEST_BODY,
          changes: [invalidPendingChange, PENDING_CHANGE_REQUEST],
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-invalid-amount"],
        changeOutcomes: [
          {
            changeId: "change-invalid-amount",
            status: "repair_required",
            code: "invalid_transaction",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      ...APPLY_PENDING_CHANGES_COMMAND,
      changes: [
        {
          id: "change-invalid-amount",
          kind: "invalidPendingChange",
          commandVersion: 1,
          idempotencyKey: "idem-invalid-amount",
          dependencies: [],
          expectedVersions: [PENDING_CHANGE_EXPECTED_VERSION],
          clientTimestamp: "2026-06-01T10:02:00.000Z",
          invalidCode: "invalid_transaction",
        },
        PENDING_CHANGE_REQUEST,
      ],
    });
  });

  it("keeps unsupported pending change command versions inside the batch outcome path", async () => {
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-old-app-version"],
        changeOutcomes: [
          {
            changeId: "change-old-app-version",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });
    const body = {
      ...APPLY_PENDING_CHANGES_REQUEST_BODY,
      changes: [UNSUPPORTED_PENDING_CHANGE_REQUEST, PENDING_CHANGE_REQUEST],
    } as const;

    const response = await handleCloudLedgerRequest(jsonRequest(body, "valid-token"), api.deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-old-app-version"],
        changeOutcomes: [
          {
            changeId: "change-old-app-version",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      ...APPLY_PENDING_CHANGES_COMMAND,
      changes: [UNSUPPORTED_PENDING_CHANGE_REQUEST, PENDING_CHANGE_REQUEST],
    });
  });

  it("keeps old unsupported pending changes without v1 metadata inside mixed batch outcomes", async () => {
    const oldPendingChange = {
      id: "change-old-metadata",
      kind: "createTransaction",
      commandVersion: 0,
    } as const;
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-old-metadata"],
        changeOutcomes: [
          {
            changeId: "change-old-metadata",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          ...APPLY_PENDING_CHANGES_REQUEST_BODY,
          changes: [oldPendingChange, PENDING_CHANGE_REQUEST],
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-old-metadata"],
        changeOutcomes: [
          {
            changeId: "change-old-metadata",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      ...APPLY_PENDING_CHANGES_COMMAND,
      changes: [oldPendingChange, PENDING_CHANGE_REQUEST],
    });
  });

  it("keeps unsupported Pending Change Set envelope versions inside the batch outcome path", async () => {
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-old-envelope", "change-old-envelope-two"],
        changeOutcomes: [
          {
            changeId: "change-old-envelope",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-old-envelope-two",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
        ],
        cursor: "ledger:0",
      },
    });
    const body = {
      action: "applyPendingChanges",
      commandVersion: 0,
      deviceId: "device-ios-17-pro",
      batchId: "batch-old-envelope",
      changes: [{ id: "change-old-envelope" }, { id: "change-old-envelope-two" }],
    } as const;

    const response = await handleCloudLedgerRequest(jsonRequest(body, "valid-token"), api.deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-old-envelope", "change-old-envelope-two"],
        changeOutcomes: [
          {
            changeId: "change-old-envelope",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-old-envelope-two",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
        ],
        cursor: "ledger:0",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      commandVersion: 0,
      deviceId: "device-ios-17-pro",
      batchId: "batch-old-envelope",
      changes: [{ id: "change-old-envelope" }, { id: "change-old-envelope-two" }],
    });
  });

  it("keeps identifiable old Pending Change Set envelopes without v1 envelope fields inside the batch outcome path", async () => {
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-old"],
        changeOutcomes: [
          {
            changeId: "change-old",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
        ],
        cursor: "ledger:0",
      },
    });
    const body = {
      action: "applyPendingChanges",
      commandVersion: 0,
      changes: [{ id: "change-old" }],
    } as const;

    const response = await handleCloudLedgerRequest(jsonRequest(body, "valid-token"), api.deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-old"],
        changeOutcomes: [
          {
            changeId: "change-old",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
        ],
        cursor: "ledger:0",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      commandVersion: 0,
      deviceId: null,
      batchId: null,
      changes: [{ id: "change-old" }],
    });
  });

  it("keeps unsupported pending change kinds inside the batch outcome path", async () => {
    const unsupportedKindChange = {
      id: "change-unsupported-kind",
      kind: "deleteTransaction",
      commandVersion: 1,
      idempotencyKey: "idem-unsupported-kind",
      dependencies: [],
      expectedVersions: [],
      clientTimestamp: "2026-06-01T10:02:00.000Z",
    } as const;
    const api = createCloudLedgerApiDeps({
      applyPendingChangesResult: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-unsupported-kind"],
        changeOutcomes: [
          {
            changeId: "change-unsupported-kind",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          ...APPLY_PENDING_CHANGES_REQUEST_BODY,
          changes: [unsupportedKindChange, PENDING_CHANGE_REQUEST],
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        rejectedChangeIds: ["change-unsupported-kind"],
        changeOutcomes: [
          {
            changeId: "change-unsupported-kind",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-offline-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:2",
      },
    });
    expect(api.store.applyPendingChanges).toHaveBeenCalledWith(USER_ID, {
      ...APPLY_PENDING_CHANGES_COMMAND,
      changes: [unsupportedKindChange, PENDING_CHANGE_REQUEST],
    });
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

  it("preserves Outlook source-provider Capture Improvement Samples at the API boundary", async () => {
    const api = createCloudLedgerApiDeps();
    const sample = {
      ...CAPTURE_IMPROVEMENT_SAMPLE,
      sourceProvider: "outlook",
    } as const;

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

  it("rejects email Capture Improvement Samples without a coarse source provider", async () => {
    const api = createCloudLedgerApiDeps();
    const { sourceProvider: _sourceProvider, ...sample } = CAPTURE_IMPROVEMENT_SAMPLE;

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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_capture_improvement_sample",
    });
    expect(api.store.retainCaptureImprovementSample).not.toHaveBeenCalled();
  });

  it("rejects inconsistent Capture Improvement Sample source metadata", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            sourceChannel: "wallet",
            sourceFamily: "email",
            sourceProvider: undefined,
            providerCategory: "bank",
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

  it("propagates invalid Capture Improvement Sample retain outcomes from the store", async () => {
    const api = createCloudLedgerApiDeps({
      retainCaptureImprovementResult: { code: "invalid_capture_improvement_sample" },
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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_capture_improvement_sample",
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

  it("rejects short alphanumeric reference values in Capture Improvement Samples", async () => {
    const api = createCloudLedgerApiDeps();

    const response = await handleCloudLedgerRequest(
      jsonRequest(
        {
          action: "retainCaptureImprovementSample",
          sample: {
            ...CAPTURE_IMPROVEMENT_SAMPLE,
            templateShape: "Ref No. A123B por [AMOUNT]. Autorizacion No. A1B2C.",
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

function pendingChangeRequest(index: number) {
  const suffix = String(index).padStart(2, "0");
  return {
    id: `change-offline-${suffix}`,
    kind: "createTransaction",
    commandVersion: 1,
    idempotencyKey: `idem-offline-${suffix}`,
    dependencies: [],
    expectedVersions: [],
    clientTimestamp: "2026-06-01T10:02:00.000Z",
    transaction: {
      ...CREATE_TRANSACTION_PAYLOAD,
      id: `txn-offline-${suffix}`,
    },
  };
}

type CloudLedgerApiDepsOptions = {
  readonly authError?: { readonly message: string };
  readonly bootstrapByUserId?: ReadonlyMap<string, LedgerBootstrapPayload>;
  readonly applyPendingChangesResult?: unknown;
  readonly createTransactionResult?: unknown;
  readonly retainCaptureImprovementResult?: unknown;
  readonly userId?: string;
};

function defaultLedgerBootstrapPayload(): LedgerBootstrapPayload {
  return {
    cursor: CURSOR,
    categories: [],
    financialAccounts: [],
    transactions: [],
    tombstones: [],
  };
}

function defaultCreateTransactionOutcome() {
  return {
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
  };
}

function defaultApplyPendingChangesOutcome() {
  return {
    code: "accepted",
    acceptedChangeIds: [],
    rejectedChangeIds: [],
    cursor: "ledger:2",
  };
}

function createBootstrapLedgerMock(options: CloudLedgerApiDepsOptions) {
  const bootstrapByUserId = options.bootstrapByUserId ?? new Map();
  return vi.fn<(...args: any[]) => any>((userId: string) =>
    Promise.resolve(bootstrapByUserId.get(userId) ?? defaultLedgerBootstrapPayload())
  );
}

function createTransactionMock(options: CloudLedgerApiDepsOptions) {
  const result = options.createTransactionResult ?? defaultCreateTransactionOutcome();
  return vi.fn<(...args: any[]) => any>(() => Promise.resolve(result));
}

function createApplyPendingChangesMock(options: CloudLedgerApiDepsOptions) {
  const result = options.applyPendingChangesResult ?? defaultApplyPendingChangesOutcome();
  return vi.fn<(...args: any[]) => any>(() => Promise.resolve(result));
}

function createCaptureImprovementSampleMock(options: CloudLedgerApiDepsOptions) {
  const result = options.retainCaptureImprovementResult ?? { code: "accepted" };
  return vi.fn<(...args: any[]) => any>(() => Promise.resolve(result));
}

function createAcceptedMock() {
  return vi.fn<(...args: any[]) => any>(() => Promise.resolve({ code: "accepted" }));
}

function createCloudLedgerApiStore(options: CloudLedgerApiDepsOptions) {
  return {
    bootstrapLedger: createBootstrapLedgerMock(options),
    createTransaction: createTransactionMock(options),
    applyPendingChanges: createApplyPendingChangesMock(options),
    retainCaptureImprovementSample: createCaptureImprovementSampleMock(options),
    deleteCaptureImprovementSamples: createAcceptedMock(),
    setCaptureImprovementPreference: createAcceptedMock(),
  };
}

function createCloudLedgerApiAuth(options: CloudLedgerApiDepsOptions) {
  return {
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
  };
}

function createCloudLedgerApiDeps(options: CloudLedgerApiDepsOptions = {}) {
  const store = createCloudLedgerApiStore(options);

  return {
    store,
    deps: {
      auth: createCloudLedgerApiAuth(options),
      store,
    },
  };
}
