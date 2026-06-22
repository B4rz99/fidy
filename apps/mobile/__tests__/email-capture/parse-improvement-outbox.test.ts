import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countPendingEmailParseImprovementSamples,
  deleteEmailParseImprovementSamplesForUser,
  enqueueEmailParseImprovementRequests,
  flushPendingEmailParseImprovementSamples,
  pruneStaleFailedEmailSourceEvents,
} from "@/features/email-capture/services/email-parse-improvement-outbox";
import { recordProcessedCaptureSourceEventWithLocalLedger } from "@/infrastructure/local-ledger/public";
import { emailParseImprovementSamples, processedSourceEvents } from "@/shared/db/schema";
import type { AnyDb } from "@/shared/db";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

const { mockDeleteCaptureParseImprovementSamplesForUser, mockShareCaptureParseImprovementSample } =
  vi.hoisted(() => ({
    mockDeleteCaptureParseImprovementSamplesForUser: vi.fn<(...args: unknown[]) => Promise<void>>(
      () => Promise.resolve()
    ),
    mockShareCaptureParseImprovementSample: vi.fn<(sample: unknown) => Promise<void>>(() =>
      Promise.resolve()
    ),
  }));

vi.mock("@/features/capture-sources/diagnostics.public", () => ({
  buildNotificationParseImprovementSample: (input: {
    readonly parserTemplate?: string;
    readonly senderDomain?: string | null;
    readonly source: string;
    readonly status: "failed" | "needs_review";
    readonly confidence: number | null;
    readonly parseMethod: "regex" | "llm";
    readonly rawText: string;
  }) => ({
    template: input.parserTemplate ?? input.rawText,
    senderDomain: input.senderDomain ?? undefined,
    source: input.source,
    status: input.status,
    confidenceBucket: input.confidence == null ? "none" : "medium",
    parseMethod: input.parseMethod,
  }),
  deleteCaptureParseImprovementSamplesForUser: (input: unknown) =>
    mockDeleteCaptureParseImprovementSamplesForUser(input),
  shareCaptureParseImprovementSample: (sample: unknown) =>
    mockShareCaptureParseImprovementSample(sample),
}));

const USER_ID = "user-1" as UserId;
const NOW = new Date("2026-05-19T10:00:00.000Z");

function createDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
  return { db: db as unknown as AnyDb, sqlite };
}

const request = {
  parserTemplate: "Compra en [MERCHANT] por [AMOUNT]",
  rawText: "Compra en Comercio por $123",
  senderDomain: "davibank.com",
  source: "email_gmail" as const,
  status: "failed" as const,
  confidence: null,
  parseMethod: "regex" as const,
};

describe("email parse improvement outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockShareCaptureParseImprovementSample.mockResolvedValue(undefined);
    mockDeleteCaptureParseImprovementSamplesForUser.mockResolvedValue(undefined);
  });

  it("skips enqueue work when there are no requests", () => {
    const { db, sqlite } = createDb();

    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [],
        now: NOW,
      })
    ).toBe(0);

    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(0);
    sqlite.close();
  });

  it("stores anonymized templates and deduplicates repeats", () => {
    const { db, sqlite } = createDb();

    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [request, request],
        now: NOW,
      })
    ).toBe(1);

    expect(db.select().from(emailParseImprovementSamples).all()).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        template: "Compra en [MERCHANT] por [AMOUNT]",
        senderDomain: "davibank.com",
        source: "email_gmail",
        status: "failed",
        parseMethod: "regex",
        sharedAt: null,
      }),
    ]);
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(1);
    sqlite.close();
  });

  it("deduplicates samples without sender domains", () => {
    const { db, sqlite } = createDb();
    const noDomainRequest = { ...request, senderDomain: null };

    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [noDomainRequest],
        now: NOW,
      })
    ).toBe(1);
    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [noDomainRequest],
        now: NOW,
      })
    ).toBe(0);

    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(1);
    sqlite.close();
  });

  it("keeps bank-specific templates with the same shape", () => {
    const { db, sqlite } = createDb();

    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [
          request,
          {
            ...request,
            senderDomain: "bbvanet.com.co",
            rawText: "Compra en Otro Comercio por $123",
          },
        ],
        now: NOW,
      })
    ).toBe(2);

    expect(
      db
        .select()
        .from(emailParseImprovementSamples)
        .all()
        .map((sample) => sample.senderDomain)
        .sort()
    ).toEqual(["bbvanet.com.co", "davibank.com"]);
    sqlite.close();
  });

  it("logs enqueue summaries when debug logging is enabled", () => {
    const { db, sqlite } = createDb();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG", "1");

    enqueueEmailParseImprovementRequests({
      db,
      userId: USER_ID,
      requests: [request],
      now: NOW,
    });

    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.enqueue", {
      requestCount: 1,
      enqueued: 1,
    });

    consoleLog.mockRestore();
    sqlite.close();
  });

  it("flushes pending templates and marks them shared", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 1, failed: 0 });

    expect(mockShareCaptureParseImprovementSample).toHaveBeenCalledWith(
      expect.objectContaining({
        parserTemplate: "Compra en [MERCHANT] por [AMOUNT]",
        rawText: "Compra en [MERCHANT] por [AMOUNT]",
        consent: true,
        userId: USER_ID,
      })
    );
    expect(db.select().from(emailParseImprovementSamples).all()[0]?.sharedAt).toBe(
      "2026-05-19T10:00:00.000Z"
    );
    sqlite.close();
  });

  it("releases the per-user flush guard when startup counting fails", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    const select = vi.spyOn(db, "select").mockImplementationOnce(() => {
      throw new Error("count failed");
    });

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("count failed");
    select.mockRestore();

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 1, failed: 0 });
    sqlite.close();
  });

  it("leaves failed flushes pending and logs failure diagnostics", async () => {
    const { db, sqlite } = createDb();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG", "1");
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce({
      code: "23514",
      reason: "privacy",
    });

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({
      shared: 0,
      failed: 1,
      failureTypes: ["unknown"],
    });

    expect(db.select().from(emailParseImprovementSamples).all()[0]?.sharedAt).toBeNull();
    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.flush.start", {
      pending: 1,
    });
    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.flush.failure", {
      errorType: "unknown",
      errorCode: "23514",
      privacyReason: "privacy",
      permanent: false,
    });

    consoleLog.mockRestore();
    sqlite.close();
  });

  it("logs error flush failures without code or privacy reason", async () => {
    const { db, sqlite } = createDb();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG", "1");
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce(new ReferenceError("missing"));

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({
      shared: 0,
      failed: 1,
      failureTypes: ["ReferenceError"],
    });

    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.flush.failure", {
      errorType: "ReferenceError",
      errorCode: null,
      privacyReason: null,
      permanent: false,
    });

    consoleLog.mockRestore();
    sqlite.close();
  });

  it("dead-letters privacy failures instead of retrying them forever", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    const error = new Error("privacy");
    error.name = "ParseImprovementSamplePrivacyError";
    Object.assign(error, { reason: "sensitive_value_pattern" });
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce(error);

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 0, failed: 1 });

    const [sample] = db.select().from(emailParseImprovementSamples).all();
    expect(sample?.sharedAt).toBeNull();
    expect(sample?.deletedAt).toBe("2026-05-19T10:00:00.000Z");
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(0);
    expect(enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request] })).toBe(
      0
    );
    sqlite.close();
  });

  it("dead-letters non-retryable insert failures", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    const error = new Error("constraint");
    error.name = "ParseImprovementSampleInsertError";
    Object.assign(error, { code: "23514" });
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce(error);

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 0, failed: 1 });

    expect(db.select().from(emailParseImprovementSamples).all()[0]?.deletedAt).toBe(
      "2026-05-19T10:00:00.000Z"
    );
    sqlite.close();
  });

  it("flushes pending templates in bounded batches", async () => {
    const { db, sqlite } = createDb();
    const requests = Array.from({ length: 11 }, (_, index) => ({
      ...request,
      parserTemplate: `Compra ${index} en [MERCHANT] por [AMOUNT]`,
      rawText: `Compra ${index} en Comercio por $123`,
    }));
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests, now: NOW });
    let inFlight = 0;
    let maxInFlight = 0;
    mockShareCaptureParseImprovementSample.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 11, failed: 0 });

    expect(maxInFlight).toBeLessThanOrEqual(10);
    sqlite.close();
  });

  it("continues past transient failures so newer pending templates can flush", async () => {
    const { db, sqlite } = createDb();
    const requests = Array.from({ length: 21 }, (_, index) => ({
      ...request,
      parserTemplate: `Compra ${index} en [MERCHANT] por [AMOUNT]`,
      rawText: `Compra ${index} en Comercio por $123`,
    }));
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests, now: NOW });
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce(new ReferenceError("network"));

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 20, failed: 1 });

    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(1);
    sqlite.close();
  });

  it("stops after marking the in-flight share when consent is revoked mid-flush", async () => {
    const { db, sqlite } = createDb();
    const requests = Array.from({ length: 3 }, (_, index) => ({
      ...request,
      parserTemplate: `Compra ${index} en [MERCHANT] por [AMOUNT]`,
      rawText: `Compra ${index} en Comercio por $123`,
    }));
    let isSharingEnabled = true;
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests, now: NOW });
    mockShareCaptureParseImprovementSample.mockImplementation(async () => {
      isSharingEnabled = false;
    });

    await expect(
      flushPendingEmailParseImprovementSamples({
        db,
        userId: USER_ID,
        now: NOW,
        isSharingEnabled: () => isSharingEnabled,
      })
    ).resolves.toMatchObject({ shared: 1, failed: 0 });

    expect(mockShareCaptureParseImprovementSample).toHaveBeenCalledTimes(1);
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(2);
    sqlite.close();
  });

  it("deletes local and remote user-linked samples when sharing is disabled", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    await flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW });
    enqueueEmailParseImprovementRequests({
      db,
      userId: USER_ID,
      requests: [{ ...request, parserTemplate: "Pago en [MERCHANT] por [AMOUNT]" }],
      now: NOW,
    });

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).resolves.toEqual({ deleted: 2 });

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledWith({
      userId: USER_ID,
    });
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(0);
    expect(db.select().from(emailParseImprovementSamples).all()).toEqual([
      expect.objectContaining({ deletedAt: "2026-05-19T10:00:00.000Z" }),
      expect.objectContaining({ deletedAt: "2026-05-19T10:00:00.000Z" }),
    ]);
    sqlite.close();
  });

  it("does not advance the continuation cursor past unprocessed rows", async () => {
    const { db, sqlite } = createDb();
    const requests = Array.from({ length: 12 }, (_, index) => ({
      ...request,
      parserTemplate: `Compra ${index} en [MERCHANT] por [AMOUNT]`,
      rawText: `Compra ${index} en Comercio por $123`,
    }));
    let consentChecks = 0;
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests, now: NOW });

    await expect(
      flushPendingEmailParseImprovementSamples({
        db,
        userId: USER_ID,
        now: NOW,
        isSharingEnabled: () => {
          consentChecks += 1;
          return consentChecks !== 3;
        },
      })
    ).resolves.toMatchObject({ shared: 1, failed: 0 });

    expect(mockShareCaptureParseImprovementSample).toHaveBeenCalledTimes(1);
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(11);
    sqlite.close();
  });

  it("coalesces concurrent flush callers onto the active flush result", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    mockShareCaptureParseImprovementSample.mockImplementationOnce(async () => {
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [
          {
            ...request,
            parserTemplate: "Pago en [MERCHANT] por [AMOUNT]",
            rawText: "Pago en Comercio por $456",
          },
        ],
        now: NOW,
      });
    });

    const [firstFlush, secondFlush] = await Promise.all([
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW }),
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW }),
    ]);

    expect(firstFlush).toMatchObject({ shared: 1, failed: 0 });
    expect(secondFlush).toMatchObject({ shared: 1, failed: 0 });
    expect(mockShareCaptureParseImprovementSample).toHaveBeenCalledTimes(1);
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(1);
    sqlite.close();
  });

  it("soft-deletes failed email source events older than retention", () => {
    const { db, sqlite } = createDb();
    recordProcessedCaptureSourceEventWithLocalLedger({
      db,
      ...sourceEventInput("old-failed", "failed", "2026-05-01T10:00:00.000Z" as IsoDateTime),
    });
    recordProcessedCaptureSourceEventWithLocalLedger({
      db,
      ...sourceEventInput("recent-failed", "failed", "2026-05-18T10:00:00.000Z" as IsoDateTime),
    });
    recordProcessedCaptureSourceEventWithLocalLedger({
      db,
      ...sourceEventInput("freshly-processed", "failed", "2026-05-01T10:00:00.000Z" as IsoDateTime),
      processedAt: "2026-05-18T10:00:00.000Z" as IsoDateTime,
    });

    expect(pruneStaleFailedEmailSourceEvents({ db, userId: USER_ID, now: NOW })).toBe(1);

    expect(
      db
        .select({ deletedAt: processedSourceEvents.deletedAt })
        .from(processedSourceEvents)
        .where(eq(processedSourceEvents.sourceEventId, "old-failed"))
        .all()[0]?.deletedAt
    ).toBe("2026-05-19T10:00:00.000Z");
    expect(
      db
        .select({ deletedAt: processedSourceEvents.deletedAt })
        .from(processedSourceEvents)
        .where(eq(processedSourceEvents.sourceEventId, "recent-failed"))
        .all()[0]?.deletedAt
    ).toBeNull();
    expect(
      db
        .select({ deletedAt: processedSourceEvents.deletedAt })
        .from(processedSourceEvents)
        .where(eq(processedSourceEvents.sourceEventId, "freshly-processed"))
        .all()[0]?.deletedAt
    ).toBeNull();
    sqlite.close();
  });
});

function sourceEventInput(
  sourceEventId: string,
  status: string,
  updatedAt: IsoDateTime
): Omit<Parameters<typeof recordProcessedCaptureSourceEventWithLocalLedger>[0], "db"> {
  return {
    userId: USER_ID,
    sourceFamily: "email",
    sourceId: "email_gmail",
    sourceEventId,
    status: status as Parameters<
      typeof recordProcessedCaptureSourceEventWithLocalLedger
    >[0]["status"],
    failureReason: null,
    receivedAt: updatedAt,
    processedAt: updatedAt,
  };
}
