import { and, asc, count, eq, gt, isNull, or } from "drizzle-orm";
import {
  buildNotificationParseImprovementSample,
  deleteCaptureParseImprovementSamplesForUser,
  shareCaptureParseImprovementSample,
} from "@/features/capture-sources/diagnostics.public";
import type { AnyDb } from "@/shared/db";
import { emailParseImprovementSamples } from "@/shared/db/schema";
import { generateEmailParseImprovementSampleId } from "@/shared/lib/generate-id";
import { toIsoDateTime } from "@/shared/lib";
import type { EmailParseImprovementSampleId, IsoDateTime, UserId } from "@/shared/types/branded";
import { isEmailCaptureDebugEnabled } from "./email-capture-debug";
import {
  getEmailParseImprovementSampleDedupeKey,
  hasEmailParseImprovementSample,
} from "./email-parse-improvement-dedupe";
export { pruneStaleFailedEmailSourceEvents } from "./email-parse-improvement-prune";
import type { EmailParseImprovementRequest } from "./email-pipeline-service/types";

const FLUSH_BATCH_SIZE = 10;
const PERMANENT_INSERT_ERROR_CODES = new Set(["22P02", "23502", "23505", "23514"]);
const activeFlushesByUserId = new Map<UserId, Promise<FlushResult>>();

type FlushCursor = {
  readonly createdAt: IsoDateTime;
  readonly id: EmailParseImprovementSampleId;
};

type FlushResult = {
  readonly shared: number;
  readonly failed: number;
  readonly failureTypes?: readonly string[];
};

const logParseImprovementOutboxForDebug = (
  event: string,
  payload: Record<string, number | string | boolean | null>
): void => {
  if (!isEmailCaptureDebugEnabled()) return;

  // eslint-disable-next-line no-console
  console.log(`[email-capture] parse-improvement.${event}`, payload);
};

const getErrorName = (error: unknown): string => (error instanceof Error ? error.name : "unknown");

const getErrorCode = (error: unknown): string | null =>
  error != null && typeof error === "object" && "code" in error ? String(error.code) : null;

const getPrivacyReason = (error: unknown): string | null =>
  error != null && typeof error === "object" && "reason" in error ? String(error.reason) : null;

const isPermanentShareFailure = (error: unknown): boolean => {
  if (getErrorName(error) === "ParseImprovementSamplePrivacyError") return true;
  const code = getErrorCode(error);
  return getErrorName(error) === "ParseImprovementSampleInsertError" && code !== null
    ? PERMANENT_INSERT_ERROR_CODES.has(code)
    : false;
};

export function countPendingEmailParseImprovementSamples(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
}): number {
  return (
    input.db
      .select({ count: count() })
      .from(emailParseImprovementSamples)
      .where(
        and(
          eq(emailParseImprovementSamples.userId, input.userId),
          isNull(emailParseImprovementSamples.sharedAt),
          isNull(emailParseImprovementSamples.deletedAt)
        )
      )
      .get()?.count ?? 0
  );
}

export async function deleteEmailParseImprovementSamplesForUser(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly now?: Date;
}): Promise<{ readonly deleted: number }> {
  const deletedAt = toIsoDateTime(input.now ?? new Date());
  const deleted = input.db
    .update(emailParseImprovementSamples)
    .set({ deletedAt })
    .where(
      and(
        eq(emailParseImprovementSamples.userId, input.userId),
        isNull(emailParseImprovementSamples.deletedAt)
      )
    )
    .run().changes;

  await deleteCaptureParseImprovementSamplesForUser({ userId: input.userId });
  logParseImprovementOutboxForDebug("delete", { deleted });
  return { deleted };
}

export function enqueueEmailParseImprovementRequests(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly requests: readonly EmailParseImprovementRequest[];
  readonly now?: Date;
}): number {
  if (input.requests.length === 0) return 0;

  const createdAt = toIsoDateTime(input.now ?? new Date());
  const seen = new Set<string>();
  const rows = input.requests.flatMap((request) => {
    const sample = buildNotificationParseImprovementSample(request);
    const row = {
      id: generateEmailParseImprovementSampleId(),
      userId: input.userId,
      template: sample.template,
      senderDomain: sample.senderDomain ?? null,
      source: sample.source,
      status: sample.status,
      confidence: request.confidence,
      parseMethod: sample.parseMethod,
      createdAt,
      sharedAt: null,
      deletedAt: null,
    };
    const key = getEmailParseImprovementSampleDedupeKey(row);
    if (seen.has(key)) return [];
    seen.add(key);
    return hasEmailParseImprovementSample({ db: input.db, userId: input.userId, sample: row })
      ? []
      : [row];
  });

  if (rows.length === 0) return 0;

  const enqueued = input.db
    .insert(emailParseImprovementSamples)
    .values(rows)
    .onConflictDoNothing()
    .run().changes;
  logParseImprovementOutboxForDebug("enqueue", {
    requestCount: input.requests.length,
    enqueued,
  });
  return enqueued;
}

export async function flushPendingEmailParseImprovementSamples(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly now?: Date;
  readonly isSharingEnabled?: () => boolean;
}): Promise<FlushResult> {
  const activeFlush = activeFlushesByUserId.get(input.userId);
  if (activeFlush) return activeFlush;

  const flush = (async (): Promise<FlushResult> => {
    const isSharingEnabled = input.isSharingEnabled ?? (() => true);
    if (!isSharingEnabled()) return { shared: 0, failed: 0 };

    const sharedAt = toIsoDateTime(input.now ?? new Date());
    if (isEmailCaptureDebugEnabled()) {
      logParseImprovementOutboxForDebug("flush.start", {
        pending: countPendingEmailParseImprovementSamples(input),
      });
    }

    const flushBatch = async (
      cursor: FlushCursor | null
    ): Promise<{
      shared: number;
      failed: number;
      failureTypes: readonly string[];
      cursor: FlushCursor | null;
      shouldContinue: boolean;
    }> => {
      const cursorFilter =
        cursor === null
          ? undefined
          : or(
              gt(emailParseImprovementSamples.createdAt, cursor.createdAt),
              and(
                eq(emailParseImprovementSamples.createdAt, cursor.createdAt),
                gt(emailParseImprovementSamples.id, cursor.id)
              )
            );
      const pending = await input.db
        .select()
        .from(emailParseImprovementSamples)
        .where(
          and(
            eq(emailParseImprovementSamples.userId, input.userId),
            isNull(emailParseImprovementSamples.sharedAt),
            isNull(emailParseImprovementSamples.deletedAt),
            cursorFilter
          )
        )
        .orderBy(asc(emailParseImprovementSamples.createdAt), asc(emailParseImprovementSamples.id))
        .limit(FLUSH_BATCH_SIZE);
      if (pending.length === 0) {
        return { shared: 0, failed: 0, failureTypes: [], cursor: null, shouldContinue: false };
      }

      const results = [];
      const processedSamples: typeof pending = [];
      for (const sample of pending) {
        if (!isSharingEnabled()) break;
        processedSamples.push(sample);
        results.push(
          await (async () => {
            try {
              await shareCaptureParseImprovementSample({
                rawText: sample.template,
                parserTemplate: sample.template,
                senderDomain: sample.senderDomain,
                source: sample.source,
                status: sample.status as "failed" | "needs_review",
                confidence: sample.confidence,
                parseMethod: sample.parseMethod as "regex" | "llm",
                consent: true,
                userId: input.userId,
              }).catch((error) => {
                if (isPermanentShareFailure(error)) {
                  input.db
                    .update(emailParseImprovementSamples)
                    .set({ deletedAt: sharedAt })
                    .where(
                      and(
                        eq(emailParseImprovementSamples.id, sample.id),
                        isNull(emailParseImprovementSamples.sharedAt),
                        isNull(emailParseImprovementSamples.deletedAt)
                      )
                    )
                    .run();
                }
                throw error;
              });

              const value =
                input.db
                  .update(emailParseImprovementSamples)
                  .set({ sharedAt })
                  .where(
                    and(
                      eq(emailParseImprovementSamples.id, sample.id),
                      isNull(emailParseImprovementSamples.sharedAt),
                      isNull(emailParseImprovementSamples.deletedAt)
                    )
                  )
                  .run().changes === 1;
              return { status: "fulfilled" as const, value };
            } catch (reason) {
              return { status: "rejected" as const, reason };
            }
          })()
        );
        if (!isSharingEnabled()) break;
      }
      const failedResults = results.filter((result) => result.status === "rejected");
      const failureTypes = failedResults.map((result) => getErrorName(result.reason));
      failedResults.forEach((result) => {
        const reason = result.reason;
        logParseImprovementOutboxForDebug("flush.failure", {
          errorType: getErrorName(reason),
          errorCode: getErrorCode(reason),
          privacyReason: getPrivacyReason(reason),
          permanent: isPermanentShareFailure(reason),
        });
      });

      const shared = results.filter(
        (result) => result.status === "fulfilled" && result.value
      ).length;
      const lastSample = processedSamples.at(-1);
      return {
        shared,
        failed: failedResults.length,
        failureTypes,
        cursor: lastSample ? { createdAt: lastSample.createdAt, id: lastSample.id } : null,
        shouldContinue: isSharingEnabled() && processedSamples.length === FLUSH_BATCH_SIZE,
      };
    };

    const flushAll = async (
      cursor: FlushCursor | null,
      totals: FlushResult = { shared: 0, failed: 0 }
    ): Promise<FlushResult> => {
      const result = await flushBatch(cursor);
      const nextTotals = {
        shared: totals.shared + result.shared,
        failed: totals.failed + result.failed,
        failureTypes: [...(totals.failureTypes ?? []), ...result.failureTypes],
      };
      return result.shouldContinue && result.cursor
        ? flushAll(result.cursor, nextTotals)
        : nextTotals;
    };

    return await flushAll(null);
  })();
  activeFlushesByUserId.set(input.userId, flush);
  try {
    return await flush;
  } finally {
    if (activeFlushesByUserId.get(input.userId) === flush) {
      activeFlushesByUserId.delete(input.userId);
    }
  }
}
