// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEmail } from "@/features/email-capture/schema";
import { processEmails } from "@/features/email-capture/services/email-pipeline";
import { requireUserId } from "@/shared/types/assertions";

const mockCaptureError = vi.fn<(...args: any[]) => any>();

vi.mock("@/shared/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
  captureWarning: vi.fn<(...args: any[]) => any>(),
}));

const mockGetProcessedEmailSourceEventIds = vi
  .fn<(...args: any[]) => any>()
  .mockResolvedValue(new Set<string>());
const mockInsertProcessedEmailSourceEvent = vi.fn<(...args: any[]) => any>();
const mockInsertTransaction = vi.fn<(...args: any[]) => any>();
const mockLookupMerchantRule = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn<(...args: any[]) => any>();
const mockParseEmailApi = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockFindDuplicateTransaction = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockEnsureDefaultFinancialAccount = vi.fn<(...args: any[]) => any>();
mockEnsureDefaultFinancialAccount.mockImplementation((_: unknown, userId: string) => ({
  id: `fa-default-${userId}`,
}));
const mockGetPendingRetryEmailSourceEvents = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
const mockMarkSourceEventForRetry = vi.fn<(...args: any[]) => any>();
const mockMarkSourceEventPermanentlyFailed = vi.fn<(...args: any[]) => any>();
const mockMarkSourceEventRetrySuccess = vi.fn<(...args: any[]) => any>();
const mockUpdateProcessedSourceEventStatus = vi.fn<(...args: any[]) => any>();
const mockBuildEmailCaptureEvidence = vi.fn<(...args: any[]) => any>().mockReturnValue([
  {
    sourceFamily: "bancolombia",
    evidenceType: "sender_email",
    scope: "email:bancolombia:sender",
    value: "notificaciones@bancolombia.com.co",
  },
]);
const mockSaveCaptureEvidenceRows = vi.fn<(...args: any[]) => any>();
const mockLinkCaptureEvidenceToTransaction = vi.fn<(...args: any[]) => any>();

type MaterializedEvidenceLink = Record<string, unknown>;
type MaterializedEvidenceRow = Record<string, unknown> & { id: string; deletedAt: null };

const toMaterializedEvidenceRow =
  (link: MaterializedEvidenceLink) =>
  (row: Record<string, unknown>, index: number): MaterializedEvidenceRow => ({
    id: `ce-${index + 1}`,
    ...row,
    ...link,
    deletedAt: null,
  });

vi.mock("@/features/capture-sources/lib/dedup", () => ({
  findDuplicateTransaction: (...args: unknown[]) => mockFindDuplicateTransaction(...args),
}));

vi.mock("@/features/email-capture/lib/repository", () => ({
  getProcessedEmailSourceEventIds: (...args: unknown[]) =>
    mockGetProcessedEmailSourceEventIds(...args),
  insertProcessedEmailSourceEvent: (...args: unknown[]) =>
    mockInsertProcessedEmailSourceEvent(...args),
  getPendingRetryEmailSourceEvents: (...args: unknown[]) =>
    mockGetPendingRetryEmailSourceEvents(...args),
  markSourceEventForRetry: (...args: unknown[]) => mockMarkSourceEventForRetry(...args),
  markSourceEventPermanentlyFailed: (...args: unknown[]) =>
    mockMarkSourceEventPermanentlyFailed(...args),
  markSourceEventRetrySuccess: (...args: unknown[]) => mockMarkSourceEventRetrySuccess(...args),
  updateProcessedSourceEventStatus: (...args: unknown[]) =>
    mockUpdateProcessedSourceEventStatus(...args),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: unknown[]) => mockInsertTransaction(...args),
}));

vi.mock("@/features/financial-accounts", () => ({
  ensureDefaultFinancialAccount: (...args: unknown[]) => mockEnsureDefaultFinancialAccount(...args),
}));

vi.mock("@/features/capture-evidence", () => ({
  buildEmailCaptureEvidence: (...args: unknown[]) => mockBuildEmailCaptureEvidence(...args),
  materializeCaptureEvidenceRows: (
    evidence: Record<string, unknown>[],
    link: MaterializedEvidenceLink
  ) => evidence.map(toMaterializedEvidenceRow(link)),
  saveCaptureEvidenceRows: (...args: unknown[]) => mockSaveCaptureEvidenceRows(...args),
  linkCaptureEvidenceToTransaction: (...args: unknown[]) =>
    mockLinkCaptureEvidenceToTransaction(...args),
}));

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  lookupMerchantRule: (...args: unknown[]) => mockLookupMerchantRule(...args),
  insertMerchantRule: (...args: unknown[]) => mockInsertMerchantRule(...args),
}));

vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  parseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
  retryableParseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
}));

const mockGenerateId = vi.fn<(...args: any[]) => any>();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: unknown[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
  generateProcessedSourceEventId: () => mockGenerateId("pse"),
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
    mockGetProcessedEmailSourceEventIds.mockReset();
    mockGetProcessedEmailSourceEventIds.mockResolvedValue(new Set<string>());
    mockInsertProcessedEmailSourceEvent.mockResolvedValue(undefined);
    mockInsertTransaction.mockResolvedValue(undefined);
    mockLookupMerchantRule.mockResolvedValue(null);
    mockInsertMerchantRule.mockResolvedValue(undefined);
    mockParseEmailApi.mockResolvedValue(null);
    mockFindDuplicateTransaction.mockResolvedValue(null);
    mockGetPendingRetryEmailSourceEvents.mockResolvedValue([]);
    mockMarkSourceEventForRetry.mockResolvedValue(undefined);
    mockMarkSourceEventPermanentlyFailed.mockResolvedValue(undefined);
    mockMarkSourceEventRetrySuccess.mockResolvedValue(undefined);
    mockUpdateProcessedSourceEventStatus.mockResolvedValue(undefined);
    mockSaveCaptureEvidenceRows.mockResolvedValue(undefined);
    mockLinkCaptureEvidenceToTransaction.mockResolvedValue(undefined);
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
