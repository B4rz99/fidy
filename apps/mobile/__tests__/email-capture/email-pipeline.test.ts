// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BankSender } from "@/features/email-capture/lib/bank-senders";
import type { RawEmail } from "@/features/email-capture/schema";

const mockGetProcessedEmailByExternalId = vi.fn();
const mockInsertProcessedEmail = vi.fn();
const mockInsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();

vi.mock("@/features/email-capture/lib/repository", () => ({
  getProcessedEmailByExternalId: (...args: unknown[]) => mockGetProcessedEmailByExternalId(...args),
  insertProcessedEmail: (...args: unknown[]) => mockInsertProcessedEmail(...args),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: unknown[]) => mockInsertTransaction(...args),
  enqueueSync: (...args: unknown[]) => mockEnqueueSync(...args),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: unknown[]) => mockGenerateId(...args),
}));

import { processEmails } from "@/features/email-capture/services/email-pipeline";

const mockDb = {} as any;
const USER_ID = "user-1";

const SENDERS: BankSender[] = [
  { bank: "Bancolombia", email: "notificaciones@bancolombia.com.co" },
  { bank: "BBVA", email: "bbva@bbvanet.com.co" },
];

function makeRawEmail(overrides: Partial<RawEmail> = {}): RawEmail {
  return {
    externalId: "ext-1",
    from: "notificaciones@bancolombia.com.co",
    subject: "Compra aprobada",
    body: "Su compra por $50.000 fue aprobada",
    receivedAt: "2026-03-05T10:00:00Z",
    provider: "gmail",
    ...overrides,
  };
}

describe("email processing pipeline", () => {
  let idCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockGenerateId.mockImplementation((prefix: string) => {
      idCounter++;
      return `${prefix}-${idCounter}`;
    });
    mockGetProcessedEmailByExternalId.mockResolvedValue(null);
    mockInsertProcessedEmail.mockResolvedValue(undefined);
    mockInsertTransaction.mockResolvedValue(undefined);
    mockEnqueueSync.mockResolvedValue(undefined);
  });

  it("filters out emails from unknown senders", async () => {
    const emails = [makeRawEmail({ from: "promo@random.com" })];
    const parseFn = vi.fn();

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(parseFn).not.toHaveBeenCalled();
    expect(result.filtered).toBe(1);
    expect(result.saved).toBe(0);
  });

  it("skips already processed emails", async () => {
    mockGetProcessedEmailByExternalId.mockResolvedValueOnce({
      id: "pe-1",
      externalId: "ext-1",
      status: "success",
    });

    const emails = [makeRawEmail()];
    const parseFn = vi.fn();

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(parseFn).not.toHaveBeenCalled();
    expect(result.skippedDuplicate).toBe(1);
  });

  it("marks email as failed when parseFn returns null", async () => {
    const emails = [makeRawEmail()];
    const parseFn = vi.fn().mockResolvedValue(null);

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        externalId: "ext-1",
        status: "failed",
        failureReason: "parse_failed",
      })
    );
  });

  it("saves transaction and marks email as success when parseFn returns data", async () => {
    const emails = [makeRawEmail()];
    const parseFn = vi.fn().mockResolvedValue({
      type: "expense",
      amountCents: 5000000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(result.saved).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        userId: USER_ID,
        type: "expense",
        amountCents: 5000000,
        source: "email_gmail",
      })
    );
    expect(mockEnqueueSync).toHaveBeenCalled();
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        externalId: "ext-1",
        status: "success",
      })
    );
  });

  it("marks email as failed when Zod validation fails", async () => {
    const emails = [makeRawEmail()];
    const parseFn = vi.fn().mockResolvedValue({
      type: "expense",
      amountCents: -100,
      categoryId: "other",
      description: "Bad",
      date: "2026-03-05",
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "failed",
        failureReason: expect.stringContaining("validation"),
      })
    );
  });

  it("processes multiple emails in a batch", async () => {
    const emails = [
      makeRawEmail({ externalId: "ext-1" }),
      makeRawEmail({ externalId: "ext-2", from: "promo@random.com" }),
      makeRawEmail({ externalId: "ext-3" }),
    ];

    const parseFn = vi
      .fn()
      .mockResolvedValueOnce({
        type: "expense",
        amountCents: 5000000,
        categoryId: "other",
        description: "Compra 1",
        date: "2026-03-05",
      })
      .mockResolvedValueOnce(null);

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(result.filtered).toBe(1);
    expect(result.saved).toBe(1);
    expect(result.failed).toBe(1);
    expect(parseFn).toHaveBeenCalledTimes(2);
  });

  it("sets source to email_outlook for outlook provider", async () => {
    const emails = [makeRawEmail({ provider: "outlook" })];
    const parseFn = vi.fn().mockResolvedValue({
      type: "income",
      amountCents: 100000,
      categoryId: "salary",
      description: "Deposito",
      date: "2026-03-05",
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(result.saved).toBe(1);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ source: "email_outlook" })
    );
  });

  it("marks email as failed when parseFn throws", async () => {
    const emails = [makeRawEmail()];
    const parseFn = vi.fn().mockRejectedValue(new Error("LLM timeout"));

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS, parseFn);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "failed",
        failureReason: "parse_error",
      })
    );
  });

  it("returns zero counts for empty input", async () => {
    const parseFn = vi.fn();

    const result = await processEmails(mockDb, USER_ID, [], SENDERS, parseFn);

    expect(result).toEqual({
      filtered: 0,
      skippedDuplicate: 0,
      saved: 0,
      failed: 0,
    });
  });
});
