// biome-ignore-all lint/suspicious/noExplicitAny: repository tests use a minimal Drizzle-like double
import { describe, expect, it, vi } from "vitest";
import { acceptSourceEventFinancialMeaningReviewByIdInTransaction } from "@/features/email-capture/lib/source-event-review-repository";

vi.mock("drizzle-orm", () => ({
  and: vi.fn<(...args: any[]) => any>((...args: unknown[]) => ({ type: "and", args })),
  eq: vi.fn<(...args: any[]) => any>((left: unknown, right: unknown) => ({
    type: "eq",
    left,
    right,
  })),
  isNull: vi.fn<(...args: any[]) => any>((value: unknown) => ({ type: "isNull", value })),
}));

vi.mock("@/shared/db/schema", () => ({
  processedSourceEvents: {
    id: "processed_id",
    userId: "processed_user_id",
    sourceFamily: "processed_source_family",
    status: "processed_status",
    deletedAt: "processed_deleted_at",
  },
  reviewCandidates: {
    id: "review_id",
    processedSourceEventId: "review_processed_source_event_id",
    userId: "review_user_id",
    status: "review_status",
    deletedAt: "review_deleted_at",
  },
}));

function makeTx(changes: readonly number[]) {
  const run = vi.fn<(...args: any[]) => any>();
  changes.forEach((changeCount) => run.mockReturnValueOnce({ changes: changeCount }));
  const where = vi.fn<(...args: any[]) => any>(() => ({ run }));
  const set = vi.fn<(...args: any[]) => any>(() => ({ where }));
  const update = vi.fn<(...args: any[]) => any>(() => ({ set }));
  return { tx: { update } as never, update, set, where, run };
}

const input = {
  userId: "user-1",
  processedSourceEventId: "source-event-1",
  reviewCandidateId: "review-1",
  transactionId: "tx-1",
  updatedAt: "2026-04-18T10:00:00.000Z",
} as never;

describe("source event review repository", () => {
  it("accepts the target candidate and rejects pending siblings in one transaction", () => {
    const { tx, run } = makeTx([1, 1, 2]);

    const accepted = acceptSourceEventFinancialMeaningReviewByIdInTransaction(tx, input);

    expect(accepted).toBe(true);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("returns false when the source event is no longer active", () => {
    const { tx, run } = makeTx([0]);

    const accepted = acceptSourceEventFinancialMeaningReviewByIdInTransaction(tx, input);

    expect(accepted).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
