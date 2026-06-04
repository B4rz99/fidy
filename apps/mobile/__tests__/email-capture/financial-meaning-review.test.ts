// biome-ignore-all lint/suspicious/noExplicitAny: focused orchestration tests use lightweight module mocks
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmSourceEventFinancialMeaningReview } from "@/features/email-capture/lib/financial-meaning-review";
import type { ProcessedSourceEventId, ReviewCandidateId, UserId } from "@/shared/types/branded";

const {
  mockAcceptSourceEventReview,
  mockConfirmReviewCandidateAsTransaction,
  mockEnsureDefaultFinancialAccount,
  mockGetSourceEventReviewCandidateById,
  mockRecordAutomatedTransactionWithLocalLedger,
} = vi.hoisted(() => ({
  mockAcceptSourceEventReview: vi.fn<(...args: any[]) => any>(() => true),
  mockConfirmReviewCandidateAsTransaction: vi.fn<(...args: any[]) => any>(
    async (input, handlers) => {
      const candidate = await handlers.loadCandidate();
      return handlers.confirmTransaction({ command: input.command, candidate });
    }
  ),
  mockEnsureDefaultFinancialAccount: vi.fn<(...args: any[]) => any>(() => ({
    id: "account-default",
  })),
  mockGetSourceEventReviewCandidateById: vi.fn<(...args: any[]) => any>(),
  mockRecordAutomatedTransactionWithLocalLedger: vi.fn<(...args: any[]) => any>(
    async ({ afterRecord }) => {
      afterRecord({} as never);
      return {
        success: true,
        transaction: { id: "tx-recorded" },
      };
    }
  ),
}));

vi.mock("@/features/financial-accounts/write.public", () => ({
  ensureDefaultFinancialAccount: mockEnsureDefaultFinancialAccount,
}));

vi.mock("@/infrastructure/local-ledger/public", () => ({
  recordAutomatedTransactionWithLocalLedger: mockRecordAutomatedTransactionWithLocalLedger,
}));

vi.mock("@/local-ledger/public", () => ({
  confirmReviewCandidateAsTransaction: mockConfirmReviewCandidateAsTransaction,
}));

vi.mock("@/shared/categories", () => ({
  getBuiltInCategoryId: () => "other",
}));

vi.mock("@/shared/lib/generate-id", () => ({
  generateTransactionId: () => "tx-generated",
}));

vi.mock("@/features/email-capture/lib/repository", () => ({
  acceptSourceEventFinancialMeaningReviewByIdInTransaction: mockAcceptSourceEventReview,
  dismissSourceEventFinancialMeaningReviewById: vi.fn<(...args: any[]) => any>(),
  getFinancialMeaningSourceEventReviewRows: vi.fn<(...args: any[]) => any>(),
  getSourceEventReviewCandidateById: mockGetSourceEventReviewCandidateById,
}));

const reviewRow = {
  processedSourceEvent: {
    id: "source-event-1",
    userId: "user-1",
    receivedAt: "2026-04-18T10:00:00.000Z",
  },
  reviewCandidate: {
    id: "review-1",
    userId: "user-1",
    processedSourceEventId: "source-event-1",
    status: "pending",
    candidateKind: "transaction",
    transactionType: "expense",
    amount: 25000,
    categoryId: "food",
    description: "Lunch",
    occurredAt: "2026-04-18T09:30:00.000Z",
  },
};

describe("financial meaning review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSourceEventReviewCandidateById.mockReturnValue(reviewRow);
  });

  it("confirms a source-event review candidate as an automated transaction", async () => {
    const confirmed = await confirmSourceEventFinancialMeaningReview({} as never, {
      userId: "user-1" as UserId,
      processedSourceEventId: "source-event-1" as ProcessedSourceEventId,
      reviewCandidateId: "review-1" as ReviewCandidateId,
      now: () => "2026-04-18T11:00:00.000Z" as never,
    });

    expect(confirmed).toBe(true);
    expect(mockEnsureDefaultFinancialAccount).toHaveBeenCalledWith({} as never, "user-1", {
      now: "2026-04-18T11:00:00.000Z",
    });
    expect(mockRecordAutomatedTransactionWithLocalLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "tx-generated",
        command: expect.objectContaining({
          userId: "user-1",
          amount: 25000,
          accountId: "account-default",
          source: "email_capture",
        }),
      })
    );
    expect(mockAcceptSourceEventReview).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        transactionId: "tx-generated",
        updatedAt: "2026-04-18T11:00:00.000Z",
      })
    );
  });

  it("does not confirm review candidates without an amount", async () => {
    mockGetSourceEventReviewCandidateById.mockReturnValueOnce({
      ...reviewRow,
      reviewCandidate: { ...reviewRow.reviewCandidate, amount: null },
    });

    const confirmed = await confirmSourceEventFinancialMeaningReview({} as never, {
      userId: "user-1" as UserId,
      processedSourceEventId: "source-event-1" as ProcessedSourceEventId,
      reviewCandidateId: "review-1" as ReviewCandidateId,
    });

    expect(confirmed).toBe(false);
    expect(mockConfirmReviewCandidateAsTransaction).not.toHaveBeenCalled();
  });
});
