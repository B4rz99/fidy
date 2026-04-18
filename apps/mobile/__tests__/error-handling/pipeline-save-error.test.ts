// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEmail } from "@/features/email-capture/schema";
import { processEmails } from "@/features/email-capture/services/email-pipeline";
import { requireUserId } from "@/shared/types/assertions";

const mockCaptureError = vi.fn();

vi.mock("@/shared/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  capturePipelineEvent: vi.fn(),
  captureWarning: vi.fn(),
}));

const mockGetProcessedExternalIds = vi.fn().mockResolvedValue(new Set<string>());
const mockInsertProcessedEmail = vi.fn();
const mockInsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();
const mockLookupMerchantRule = vi.fn().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn();
const mockParseEmailApi = vi.fn().mockResolvedValue(null);
const mockFindDuplicateTransaction = vi.fn().mockResolvedValue(null);

vi.mock("@/features/capture-sources/lib/dedup", () => ({
  findDuplicateTransaction: (...args: unknown[]) => mockFindDuplicateTransaction(...args),
}));

vi.mock("@/features/email-capture/lib/repository", () => ({
  getProcessedExternalIds: (...args: unknown[]) => mockGetProcessedExternalIds(...args),
  insertProcessedEmail: (...args: unknown[]) => mockInsertProcessedEmail(...args),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: unknown[]) => mockInsertTransaction(...args),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: (...args: unknown[]) => mockEnqueueSync(...args),
}));

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  lookupMerchantRule: (...args: unknown[]) => mockLookupMerchantRule(...args),
  insertMerchantRule: (...args: unknown[]) => mockInsertMerchantRule(...args),
}));

vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  parseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: unknown[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
  generateProcessedEmailId: () => mockGenerateId("pe"),
  generateSyncQueueId: () => mockGenerateId("sq"),
}));

const mockDb = {} as any;
const USER_ID = requireUserId("user-1");

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

describe("pipeline worker save error path", () => {
  let idCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockGenerateId.mockImplementation((prefix: string) => {
      idCounter++;
      return `${prefix}-${idCounter}`;
    });
    mockGetProcessedExternalIds.mockResolvedValue(new Set<string>());
    mockInsertProcessedEmail.mockResolvedValue(undefined);
    mockInsertTransaction.mockResolvedValue(undefined);
    mockEnqueueSync.mockResolvedValue(undefined);
    mockLookupMerchantRule.mockResolvedValue(null);
    mockInsertMerchantRule.mockResolvedValue(undefined);
    mockParseEmailApi.mockResolvedValue(null);
    mockFindDuplicateTransaction.mockResolvedValue(null);
  });

  it("calls captureError and continues processing when saveTransaction throws", async () => {
    const emails = [makeRawEmail({ externalId: "ext-1" }), makeRawEmail({ externalId: "ext-2" })];

    const saveError = new Error("DB write failed");

    // First email: LLM returns valid result but insertTransaction throws
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "food",
      description: "Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });
    mockInsertTransaction.mockImplementationOnce(() => {
      throw saveError;
    });

    // Second email: LLM returns valid result, save succeeds
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 30000,
      categoryId: "transport",
      description: "Uber",
      date: "2026-03-05",
      confidence: 0.9,
    });
    mockInsertTransaction.mockResolvedValueOnce(undefined);

    const result = await processEmails(mockDb, USER_ID, emails);

    // First email failed, second succeeded
    expect(result.failed).toBe(1);
    expect(result.saved).toBe(1);
    expect(mockCaptureError).toHaveBeenCalledWith(saveError);
  });
});
