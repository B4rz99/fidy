import { pruneStaleCaptureSourceEventsWithLocalLedger } from "@/infrastructure/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { toIsoDateTime } from "@/shared/lib";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

const FAILED_EMAIL_SOURCE_EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const toRetentionBoundary = (now: Date, retentionMs: number): IsoDateTime =>
  toIsoDateTime(new Date(now.getTime() - retentionMs));

export function pruneStaleFailedEmailSourceEvents(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly now?: Date;
}): number {
  const deletedAt = toIsoDateTime(input.now ?? new Date());
  const retentionBoundary = toRetentionBoundary(
    input.now ?? new Date(),
    FAILED_EMAIL_SOURCE_EVENT_RETENTION_MS
  );

  return pruneStaleCaptureSourceEventsWithLocalLedger({
    db: input.db,
    userId: input.userId,
    sourceFamily: "email",
    status: "failed",
    retentionBoundary,
    deletedAt,
  });
}
