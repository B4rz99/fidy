import { describe, expect, test } from "vitest";
import {
  createRecordTransactionUseCase,
  type LocalLedgerEntryId,
  type RecordTransactionPorts,
} from "@/local-ledger/public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  UserId,
} from "@/shared/types/branded";

const validCommand = {
  userId: "user-1" as UserId,
  type: "expense" as const,
  amount: 12_000 as CopAmount,
  accountId: "account-1" as FinancialAccountId,
  accountAttributionState: "confirmed" as const,
  categoryId: "food" as CategoryId,
  occurredOn: "2026-05-11" as IsoDate,
  description: "Lunch",
  counterpartyName: "Cafe",
  source: "manual" as const,
};

const createPorts = (overrides: Partial<RecordTransactionPorts> = {}): RecordTransactionPorts => ({
  commit: async (transaction) => ({ ok: true, transaction }),
  canUseAccount: async () => true,
  canUseCategory: async () => true,
  today: () => "2026-05-11" as IsoDate,
  generateEntryId: () => "entry-1" as LocalLedgerEntryId,
  ...overrides,
});

const createRecordTransaction = (ports: RecordTransactionPorts = createPorts()) =>
  createRecordTransactionUseCase({ ports });

describe("RecordTransaction", () => {
  test("rejects transactions dated after the injected local ledger today", async () => {
    const result = await createRecordTransaction(
      createPorts({
        commit: async (transaction) => {
          void transaction;
          throw new Error("commit should not run");
        },
      })
    )({
      ...validCommand,
      occurredOn: "2026-05-12" as IsoDate,
    });

    expect(result).toEqual({ ok: false, code: "future-dated-transaction" });
  });

  test("rejects transactions without an account", async () => {
    const result = await createRecordTransaction()({ ...validCommand, accountId: null });

    expect(result).toEqual({ ok: false, code: "missing-account" });
  });

  test("rejects transactions without a positive amount", async () => {
    const result = await createRecordTransaction()({ ...validCommand, amount: 0 as CopAmount });

    expect(result).toEqual({ ok: false, code: "non-positive-amount" });
  });

  test("rejects accounts the user cannot use", async () => {
    const result = await createRecordTransaction(createPorts({ canUseAccount: async () => false }))(
      validCommand
    );

    expect(result).toEqual({ ok: false, code: "account-not-usable" });
  });

  test("rejects transactions without a category", async () => {
    const result = await createRecordTransaction()({ ...validCommand, categoryId: null });

    expect(result).toEqual({ ok: false, code: "missing-category" });
  });

  test("rejects categories the user cannot use", async () => {
    const result = await createRecordTransaction(
      createPorts({ canUseCategory: async () => false })
    )(validCommand);

    expect(result).toEqual({ ok: false, code: "category-not-usable" });
  });

  test("rejects manual source transactions with unresolved account attribution", async () => {
    const result = await createRecordTransaction()({
      ...validCommand,
      accountAttributionState: "unresolved",
    });

    expect(result).toEqual({ ok: false, code: "manual-source-requires-resolved-account" });
  });

  test("rejects overlong note and counterparty text instead of truncating it", async () => {
    const overlongText = "x".repeat(201);

    await expect(
      createRecordTransaction()({
        ...validCommand,
        description: overlongText,
      })
    ).resolves.toEqual({ ok: false, code: "description-too-long" });

    await expect(
      createRecordTransaction()({
        ...validCommand,
        counterpartyName: overlongText,
      })
    ).resolves.toEqual({ ok: false, code: "counterparty-name-too-long" });
  });

  test("records an accepted transaction with normalized note and counterparty text", async () => {
    const result = await createRecordTransaction()({
      ...validCommand,
      description: "  User note  ",
      counterpartyName: "  Cafe Central  ",
      source: "email_capture",
      accountAttributionState: "unresolved",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction).toMatchObject({
      id: "entry-1",
      userId: "user-1",
      description: "User note",
      counterpartyName: "Cafe Central",
      source: "email_capture",
      accountAttributionState: "unresolved",
    });
    expect(result.events).toEqual([
      { type: "local-ledger.transaction-recorded", transactionId: "entry-1" },
    ]);
  });

  test("preserves absent counterparty as null", async () => {
    const result = await createRecordTransaction()({
      ...validCommand,
      counterpartyName: "   ",
      source: "email_capture",
      accountAttributionState: "unresolved",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.counterpartyName).toBeNull();
  });

  test("returns a commit-time policy rejection without a recorded event", async () => {
    const result = await createRecordTransaction(
      createPorts({ commit: async () => ({ ok: false, code: "account-not-usable" }) })
    )(validCommand);

    expect(result).toEqual({ ok: false, code: "account-not-usable" });
  });
});
