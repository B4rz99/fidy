// biome-ignore-all lint/style/useNamingConvention: Supabase rows use snake_case fields
import { describe, expect, it, vi } from "vitest";
import { CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT } from "../../../../supabase/functions/cloud-ledger-api/model";
import { createCloudLedgerStore } from "../../../../supabase/functions/cloud-ledger-api/store";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_TRANSACTION_ID = "txn-20260622-client";
const BOOTSTRAP_RPC_DATA = {
  cursor: "ledger:3",
  categories: [],
  financialAccounts: [
    {
      id: "acct-cash",
      name: "Cash",
      type: "cash",
      currency: "COP",
      updatedAt: "2026-06-01T10:01:00.000Z",
    },
  ],
  transactions: [
    {
      id: "txn-user",
      type: "expense",
      amount: 15_000,
      currency: "COP",
      categoryId: null,
      accountId: "acct-cash",
      description: "Market",
      date: "2026-06-01",
      updatedAt: "2026-06-01T10:02:00.000Z",
    },
  ],
  tombstones: [
    {
      recordType: "transaction",
      recordId: "txn-deleted",
      deletedAt: "2026-06-02T11:00:00.000Z",
    },
  ],
} as const;
const CREATE_TRANSACTION_RPC_DATA = {
  code: "accepted",
  transaction: {
    id: CLIENT_TRANSACTION_ID,
    type: "expense",
    amount: 15_000,
    currency: "COP",
    categoryId: "cat-groceries",
    accountId: "acct-cash",
    description: "Market",
    date: "2026-06-01",
    updatedAt: "2026-06-01T10:02:00.000Z",
  },
  cursor: "ledger:4",
} as const;
const APPLY_PENDING_CHANGES_RPC_DATA = {
  code: "accepted",
  acceptedChangeIds: ["change-valid-offline-create"],
  rejectedChangeIds: ["change-rejected-offline-create"],
  changeOutcomes: [
    {
      changeId: "change-rejected-offline-create",
      status: "repair_required",
      code: "invalid_ledger_reference",
    },
    {
      changeId: "change-valid-offline-create",
      status: "accepted",
      code: "accepted",
    },
  ],
  cursor: "ledger:5",
} as const;
const CAPTURE_IMPROVEMENT_SAMPLE = {
  sourceChannel: "email",
  sourceFamily: "email",
  sourceProvider: "gmail",
  providerCategory: "bank",
  templateShape: "Compra por [AMOUNT] en [MERCHANT].",
  parseOutcome: "failed",
  confidenceBucket: "none",
  extractor: {
    method: "regex",
    version: 1,
  },
} as const;

describe("Cloud Ledger Edge store", () => {
  it("refreshes through the service-only Cloud Ledger RPC without exposing table APIs", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const payload = await store.bootstrapLedger(USER_ID, "ledger:1");

    expect(payload).toEqual({
      cursor: "ledger:3",
      categories: [],
      financialAccounts: [
        {
          id: "acct-cash",
          name: "Cash",
          type: "cash",
          currency: "COP",
          updatedAt: "2026-06-01T10:01:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-user",
          type: "expense",
          amount: 15_000,
          currency: "COP",
          categoryId: null,
          accountId: "acct-cash",
          description: "Market",
          date: "2026-06-01",
          updatedAt: "2026-06-01T10:02:00.000Z",
        },
      ],
      tombstones: [
        {
          recordType: "transaction",
          recordId: "txn-deleted",
          deletedAt: "2026-06-02T11:00:00.000Z",
        },
      ],
    });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_bootstrap", {
      p_after_sequence: "1",
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it("passes large Ledger Cursor sequences to the RPC without unsafe numeric coercion", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    await store.bootstrapLedger(USER_ID, "ledger:9007199254740993");

    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_bootstrap", {
      p_after_sequence: "9007199254740993",
      p_user_id: USER_ID,
    });
  });

  it("creates transactions through the service-only Cloud Ledger command RPC", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.createTransaction(USER_ID, {
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
    });

    expect(outcome).toEqual({
      code: "accepted",
      transaction: {
        id: CLIENT_TRANSACTION_ID,
        type: "expense",
        amount: 15_000,
        currency: "COP",
        categoryId: "cat-groceries",
        accountId: "acct-cash",
        description: "Market",
        date: "2026-06-01",
        updatedAt: "2026-06-01T10:02:00.000Z",
      },
      cursor: "ledger:4",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_create_transaction", {
      p_account_id: "acct-cash",
      p_amount: 15_000,
      p_category_id: "cat-groceries",
      p_command_version: 1,
      p_currency: "COP",
      p_date: "2026-06-01",
      p_description: "Market",
      p_transaction_id: CLIENT_TRANSACTION_ID,
      p_type: "expense",
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it("reports permanent pending-change create rejections in the batch outcome", async () => {
    const supabase = createLedgerSupabase({
      applyPendingChangesOutcome: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-rejected-offline-create"],
        changeOutcomes: [
          {
            changeId: "change-rejected-offline-create",
            status: "repair_required",
            code: "invalid_ledger_reference",
          },
        ],
        cursor: "ledger:4",
      },
    });
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.applyPendingChanges(
      USER_ID,
      pendingChangeSetCommand([rejectedPendingCreateChange()])
    );

    expect(outcome).toEqual({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-rejected-offline-create"],
      changeOutcomes: [
        {
          changeId: "change-rejected-offline-create",
          status: "repair_required",
          code: "invalid_ledger_reference",
        },
      ],
      cursor: "ledger:4",
    });
  });

  it("applies pending change sets through the service-only batch acceptance RPC", async () => {
    const supabase = createLedgerSupabase({
      applyPendingChangesOutcome: APPLY_PENDING_CHANGES_RPC_DATA,
    });
    const store = createCloudLedgerStore(supabase.client);

    const command = pendingChangeSetCommand([
      rejectedPendingCreateChange(),
      validPendingCreateChange(),
    ]);
    const outcome = await store.applyPendingChanges(USER_ID, command);

    expect(outcome).toEqual(APPLY_PENDING_CHANGES_RPC_DATA);
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_apply_pending_changes", {
      p_batch_id: "batch-20260601-offline",
      p_changes: command.changes,
      p_command_version: 1,
      p_device_id: "device-ios-17-pro",
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it("continues applying independent pending changes after a rejected create", async () => {
    const supabase = createLedgerSupabase({
      applyPendingChangesOutcome: APPLY_PENDING_CHANGES_RPC_DATA,
    });
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.applyPendingChanges(
      USER_ID,
      pendingChangeSetCommand([rejectedPendingCreateChange(), validPendingCreateChange()])
    );

    expect(outcome).toEqual(APPLY_PENDING_CHANGES_RPC_DATA);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized pending-change batches before replaying transaction RPCs", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    await expect(
      store.applyPendingChanges(USER_ID, {
        commandVersion: 1,
        deviceId: "device-ios-17-pro",
        batchId: "batch-oversized",
        changes: Array.from({ length: CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT + 1 }, (_, index) =>
          pendingCreateChange({
            categoryId: "cat-groceries",
            changeId: `change-oversized-${index}`,
            description: "Oversized",
            transactionId: `txn-oversized-${index}`,
          })
        ),
      })
    ).rejects.toThrow("Cloud Ledger pending-change batch exceeds");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("retains Capture Improvement Samples through a service-only account-linked RPC", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.retainCaptureImprovementSample(USER_ID, CAPTURE_IMPROVEMENT_SAMPLE);

    expect(outcome).toEqual({ code: "accepted" });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_retain_capture_improvement_sample", {
      p_confidence_bucket: "none",
      p_extractor_method: "regex",
      p_extractor_version: 1,
      p_parse_outcome: "failed",
      p_provider_category: "bank",
      p_source_channel: "email",
      p_source_family: "email",
      p_source_provider: "gmail",
      p_template_shape: "Compra por [AMOUNT] en [MERCHANT].",
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it("passes Outlook Capture Improvement Samples through the source-provider RPC field", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.retainCaptureImprovementSample(USER_ID, {
      ...CAPTURE_IMPROVEMENT_SAMPLE,
      sourceProvider: "outlook",
    });

    expect(outcome).toEqual({ code: "accepted" });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_retain_capture_improvement_sample", {
      p_confidence_bucket: "none",
      p_extractor_method: "regex",
      p_extractor_version: 1,
      p_parse_outcome: "failed",
      p_provider_category: "bank",
      p_source_channel: "email",
      p_source_family: "email",
      p_source_provider: "outlook",
      p_template_shape: "Compra por [AMOUNT] en [MERCHANT].",
      p_user_id: USER_ID,
    });
  });

  it("deletes Capture Improvement Samples through a service-only account-linked RPC", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.deleteCaptureImprovementSamples(USER_ID);

    expect(outcome).toEqual({ code: "accepted" });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_delete_capture_improvement_samples", {
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it("updates Capture Improvement Preference through a service-only account-linked RPC", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.setCaptureImprovementPreference(USER_ID, true);

    expect(outcome).toEqual({ code: "accepted" });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_set_capture_improvement_preference", {
      p_enabled: true,
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });
});

function rejectedPendingCreateChange() {
  return pendingCreateChange({
    changeId: "change-rejected-offline-create",
    transactionId: "txn-rejected-offline-create",
    categoryId: "cat-deleted",
    description: "Rejected",
  });
}

function validPendingCreateChange() {
  return pendingCreateChange({
    changeId: "change-valid-offline-create",
    transactionId: CLIENT_TRANSACTION_ID,
    categoryId: "cat-groceries",
    description: "Market",
  });
}

function pendingChangeSetCommand(changes: readonly ReturnType<typeof pendingCreateChange>[]) {
  return {
    commandVersion: 1,
    deviceId: "device-ios-17-pro",
    batchId: "batch-20260601-offline",
    changes,
  } as const;
}

function pendingCreateChange(input: {
  readonly categoryId: string;
  readonly changeId: string;
  readonly description: string;
  readonly transactionId: string;
}) {
  return {
    id: input.changeId,
    kind: "createTransaction",
    commandVersion: 1,
    idempotencyKey: `idem-${input.changeId}`,
    dependencies: [],
    expectedVersions: [],
    clientTimestamp: "2026-06-01T10:02:00.000Z",
    transaction: {
      id: input.transactionId,
      type: "expense",
      amount: 15_000,
      currency: "COP",
      categoryId: input.categoryId,
      accountId: "acct-cash",
      description: input.description,
      date: "2026-06-01",
    },
  } as const;
}

function createLedgerSupabase(
  options: {
    readonly applyPendingChangesOutcome?: unknown;
    readonly createTransactionOutcome?: unknown;
    readonly createTransactionOutcomes?: readonly unknown[];
  } = {}
) {
  const createTransactionOutcomes = [...(options.createTransactionOutcomes ?? [])];
  const rpc = vi.fn<(...args: any[]) => any>((functionName: string) =>
    Promise.resolve(ledgerRpcResult(functionName, options, createTransactionOutcomes))
  );
  const from = vi.fn<(...args: any[]) => any>();
  const schema = vi.fn<(...args: any[]) => any>();

  return {
    client: {
      from,
      rpc,
      schema,
    },
    from,
    rpc,
    schema,
  };
}

function ledgerRpcResult(
  functionName: string,
  options: {
    readonly applyPendingChangesOutcome?: unknown;
    readonly createTransactionOutcome?: unknown;
  },
  createTransactionOutcomes: unknown[]
) {
  return {
    data:
      functionName === "cloud_ledger_create_transaction"
        ? (createTransactionOutcomes.shift() ??
          options.createTransactionOutcome ??
          CREATE_TRANSACTION_RPC_DATA)
        : functionName === "cloud_ledger_apply_pending_changes"
          ? (options.applyPendingChangesOutcome ?? APPLY_PENDING_CHANGES_RPC_DATA)
          : functionName === "cloud_ledger_retain_capture_improvement_sample"
            ? { code: "accepted" }
            : functionName === "cloud_ledger_delete_capture_improvement_samples"
              ? { code: "accepted" }
              : functionName === "cloud_ledger_set_capture_improvement_preference"
                ? { code: "accepted" }
                : BOOTSTRAP_RPC_DATA,
    error: null,
  };
}
