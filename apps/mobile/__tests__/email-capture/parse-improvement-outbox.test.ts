import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countPendingEmailParseImprovementSamples,
  deleteEmailParseImprovementSamplesForUser,
  enqueueEmailParseImprovementRequests,
  flushPendingEmailParseImprovementSamples,
  pruneStaleFailedEmailSourceEvents,
  retryPendingEmailParseImprovementSampleDeletion,
  setEmailParseImprovementSharingPreference,
} from "@/features/email-capture/services/email-parse-improvement-outbox";
import { recordProcessedCaptureSourceEventWithLocalLedger } from "@/infrastructure/local-ledger/public";
import {
  captureImprovementDeletionRequests,
  emailParseImprovementSamples,
  processedSourceEvents,
} from "@/shared/db/schema";
import type { AnyDb } from "@/shared/db";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

const {
  mockDeleteCaptureParseImprovementSamplesForUser,
  mockSetCaptureParseImprovementPreference,
  mockShareCaptureParseImprovementSample,
} = vi.hoisted(() => ({
  mockDeleteCaptureParseImprovementSamplesForUser: vi.fn<(...args: unknown[]) => Promise<void>>(
    () => Promise.resolve()
  ),
  mockSetCaptureParseImprovementPreference: vi.fn<(...args: unknown[]) => Promise<void>>(() =>
    Promise.resolve()
  ),
  mockShareCaptureParseImprovementSample: vi.fn<(sample: unknown) => Promise<void>>(() =>
    Promise.resolve()
  ),
}));

vi.mock("@/features/capture-sources/diagnostics.public", () => ({
  buildNotificationParseImprovementSample: (input: {
    readonly providerCategory?: "bank" | "payment_app" | "wallet" | "unknown";
    readonly parserTemplate?: string;
    readonly senderDomain?: string | null;
    readonly source: string;
    readonly status: "failed" | "needs_review";
    readonly confidence: number | null;
    readonly parseMethod: "regex" | "llm";
    readonly rawText: string;
  }) => ({
    template: input.parserTemplate ?? input.rawText,
    providerCategory:
      input.providerCategory ??
      (input.senderDomain != null &&
      /banco|bank|bbva|davibank|davivienda|nequi|bancolombia/u.test(input.senderDomain)
        ? "bank"
        : "unknown"),
    source: input.source,
    status: input.status,
    confidenceBucket: input.confidence == null ? "none" : "medium",
    parseMethod: input.parseMethod,
  }),
  deleteCaptureParseImprovementSamplesForUser: (input: unknown) =>
    mockDeleteCaptureParseImprovementSamplesForUser(input),
  setCaptureParseImprovementPreference: (input: unknown) =>
    mockSetCaptureParseImprovementPreference(input),
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
    mockSetCaptureParseImprovementPreference.mockResolvedValue(undefined);
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

  it("stores anonymized templates with coarse provider category and no raw sender domain", () => {
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
        providerCategory: "bank",
        source: "email_gmail",
        status: "failed",
        parseMethod: "regex",
        sharedAt: null,
      }),
    ]);
    expect(JSON.stringify(db.select().from(emailParseImprovementSamples).all())).not.toContain(
      "davibank.com"
    );
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

  it("deduplicates same-shape samples by coarse provider category", () => {
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
          {
            ...request,
            senderDomain: "shop.example",
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
        .map((sample) => sample.providerCategory)
        .sort()
    ).toEqual(["bank", "unknown"]);
    expect(JSON.stringify(db.select().from(emailParseImprovementSamples).all())).not.toMatch(
      /bbvanet|davibank|shop\.example/u
    );
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

  it("retries the remote opt-in preference before flushing retained templates", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    mockSetCaptureParseImprovementPreference.mockRejectedValueOnce(new Error("offline"));

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("offline");

    expect(mockShareCaptureParseImprovementSample).not.toHaveBeenCalled();
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(1);

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 1, failed: 0 });

    expect(mockSetCaptureParseImprovementPreference).toHaveBeenCalledTimes(2);
    expect(mockSetCaptureParseImprovementPreference).toHaveBeenLastCalledWith({
      enabled: true,
      userId: USER_ID,
    });
    expect(mockSetCaptureParseImprovementPreference.mock.invocationCallOrder[1] ?? 0).toBeLessThan(
      mockShareCaptureParseImprovementSample.mock.invocationCallOrder[0] ?? 0
    );
    sqlite.close();
  });

  it("retains default-enabled samples without overriding an account opt-out preference", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });

    await expect(
      flushPendingEmailParseImprovementSamples({
        db,
        userId: USER_ID,
        now: NOW,
        canEnableRemotePreference: () => false,
      })
    ).resolves.toMatchObject({ shared: 1, failed: 0 });

    expect(mockSetCaptureParseImprovementPreference).not.toHaveBeenCalled();
    expect(mockShareCaptureParseImprovementSample).toHaveBeenCalledWith(
      expect.objectContaining({
        parserTemplate: "Compra en [MERCHANT] por [AMOUNT]",
        userId: USER_ID,
      })
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

  it("dead-letters privacy failures instead of retrying the same local row", async () => {
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
    sqlite.close();
  });

  it("dead-letters server opt-out rejections instead of retrying stale retention", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    const error = new Error("opted out");
    error.name = "ParseImprovementSampleOptOutError";
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce(error);

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 0, failed: 1 });

    const [sample] = db.select().from(emailParseImprovementSamples).all();
    expect(sample?.sharedAt).toBeNull();
    expect(sample?.deletedAt).toBe("2026-05-19T10:00:00.000Z");
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(0);
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

  it("dead-letters invalid boundary samples instead of retrying the same local row", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    const error = new Error("invalid sample");
    error.name = "ParseImprovementSampleInsertError";
    Object.assign(error, { code: "invalid_capture_improvement_sample" });
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce(error);

    await expect(
      flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW })
    ).resolves.toMatchObject({ shared: 0, failed: 1 });

    expect(db.select().from(emailParseImprovementSamples).all()[0]?.deletedAt).toBe(
      "2026-05-19T10:00:00.000Z"
    );
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(0);
    sqlite.close();
  });

  it("preserves active rows over tombstones when the provider migration deduplicates", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE email_parse_improvement_samples (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        template text NOT NULL,
        sender_domain text,
        source text NOT NULL,
        status text NOT NULL,
        confidence real,
        parse_method text NOT NULL,
        created_at text NOT NULL,
        shared_at text,
        deleted_at text
      );
      CREATE UNIQUE INDEX uq_email_parse_improvement_sample
        ON email_parse_improvement_samples (
          user_id,
          source,
          status,
          parse_method,
          coalesce(sender_domain, ''),
          template
        );
      INSERT INTO email_parse_improvement_samples VALUES
        ('deleted-sample', '${USER_ID}', 'Compra en [MERCHANT]', 'davibank.com', 'email_gmail', 'failed', null, 'regex', '2026-05-19T09:00:00.000Z', null, '2026-05-19T09:05:00.000Z'),
        ('active-sample', '${USER_ID}', 'Compra en [MERCHANT]', 'bbva.com', 'email_gmail', 'failed', null, 'regex', '2026-05-19T10:00:00.000Z', null, null);
    `);

    runDrizzleSqlMigration(sqlite, "0035_capture_improvement_provider_category.sql");

    expect(sqlite.prepare("select id from email_parse_improvement_samples").all()).toEqual([
      { id: "active-sample" },
    ]);
    sqlite.close();
  });

  it("classifies migrated Google Pay samples as wallet samples", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE email_parse_improvement_samples (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        template text NOT NULL,
        sender_domain text,
        source text NOT NULL,
        status text NOT NULL,
        confidence real,
        parse_method text NOT NULL,
        created_at text NOT NULL,
        shared_at text,
        deleted_at text
      );
      CREATE UNIQUE INDEX uq_email_parse_improvement_sample
        ON email_parse_improvement_samples (
          user_id,
          source,
          status,
          parse_method,
          coalesce(sender_domain, ''),
          template
        );
      INSERT INTO email_parse_improvement_samples VALUES
        ('google-pay-sample', '${USER_ID}', 'Pago por [AMOUNT]', null, 'google_pay', 'failed', null, 'regex', '2026-05-19T10:00:00.000Z', null, null);
    `);

    runDrizzleSqlMigration(sqlite, "0035_capture_improvement_provider_category.sql");

    expect(
      sqlite
        .prepare(
          "select id, provider_category as providerCategory, sender_domain as senderDomain from email_parse_improvement_samples"
        )
        .all()
    ).toEqual([
      {
        id: "google-pay-sample",
        providerCategory: "wallet",
        senderDomain: null,
      },
    ]);
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

  it("tombstones local user-linked samples immediately when remote opt-out deletion fails", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    await flushPendingEmailParseImprovementSamples({ db, userId: USER_ID, now: NOW });
    mockDeleteCaptureParseImprovementSamplesForUser.mockRejectedValueOnce(new Error("network"));

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("network");

    expect(db.select().from(emailParseImprovementSamples).all()).toEqual([
      expect.objectContaining({
        sharedAt: "2026-05-19T10:00:00.000Z",
        deletedAt: "2026-05-19T10:00:00.000Z",
      }),
    ]);
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(0);
    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        requestedAt: "2026-05-19T10:00:00.000Z",
        lastAttemptAt: "2026-05-19T10:00:00.000Z",
      }),
    ]);
    sqlite.close();
  });

  it("allows same-shape samples to enqueue again after opt-out tombstones prior samples", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).resolves.toEqual({ deleted: 1 });

    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [request],
        now: new Date("2026-05-19T10:05:00.000Z"),
      })
    ).toBe(1);
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(1);
    expect(db.select().from(emailParseImprovementSamples).all()).toEqual([
      expect.objectContaining({ deletedAt: "2026-05-19T10:00:00.000Z" }),
      expect.objectContaining({ deletedAt: null }),
    ]);
    sqlite.close();
  });

  it("keeps a durable opt-out deletion request until remote deletion succeeds", async () => {
    const { db, sqlite } = createDb();
    mockDeleteCaptureParseImprovementSamplesForUser.mockRejectedValueOnce(new Error("network"));

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("network");

    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        requestedAt: "2026-05-19T10:00:00.000Z",
        lastAttemptAt: "2026-05-19T10:00:00.000Z",
      }),
    ]);

    await expect(
      retryPendingEmailParseImprovementSampleDeletion({
        db,
        userId: USER_ID,
        now: new Date("2026-05-19T10:05:00.000Z"),
      })
    ).resolves.toEqual({ deleted: 0, retried: true });

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledTimes(2);
    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([]);
    sqlite.close();
  });

  it("serializes opt-in preference updates behind pending opt-out deletion retries", async () => {
    const { db, sqlite } = createDb();
    let resolveDelete: () => void = () => undefined;
    mockDeleteCaptureParseImprovementSamplesForUser.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );

    const deletion = deleteEmailParseImprovementSamplesForUser({
      db,
      userId: USER_ID,
      now: NOW,
    });
    await Promise.resolve();

    const optIn = setEmailParseImprovementSharingPreference({
      db,
      enabled: true,
      userId: USER_ID,
    });
    await Promise.resolve();

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledTimes(1);
    expect(mockSetCaptureParseImprovementPreference).not.toHaveBeenCalled();

    resolveDelete();
    await expect(deletion).resolves.toEqual({ deleted: 0 });
    await expect(optIn).resolves.toBeUndefined();

    expect(mockSetCaptureParseImprovementPreference).toHaveBeenCalledWith({
      enabled: true,
      userId: USER_ID,
    });
    sqlite.close();
  });

  it("drains a durable opt-out deletion request before re-enabling the remote preference", async () => {
    const { db, sqlite } = createDb();
    mockDeleteCaptureParseImprovementSamplesForUser.mockRejectedValueOnce(new Error("network"));

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("network");
    mockDeleteCaptureParseImprovementSamplesForUser.mockClear();

    await expect(
      setEmailParseImprovementSharingPreference({
        db,
        enabled: true,
        userId: USER_ID,
      })
    ).resolves.toBeUndefined();

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledWith({
      userId: USER_ID,
    });
    expect(mockSetCaptureParseImprovementPreference).toHaveBeenCalledWith({
      enabled: true,
      userId: USER_ID,
    });
    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([]);
    expect(
      mockDeleteCaptureParseImprovementSamplesForUser.mock.invocationCallOrder[0] ?? 0
    ).toBeLessThan(mockSetCaptureParseImprovementPreference.mock.invocationCallOrder[0] ?? 0);
    sqlite.close();
  });

  it("does not run a stale deletion retry after an opt-in clears the request", async () => {
    const { db, sqlite } = createDb();
    mockDeleteCaptureParseImprovementSamplesForUser.mockRejectedValueOnce(new Error("network"));

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("network");
    mockDeleteCaptureParseImprovementSamplesForUser.mockClear();

    let resolveDelete: () => void = () => undefined;
    mockDeleteCaptureParseImprovementSamplesForUser.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );

    const optIn = setEmailParseImprovementSharingPreference({
      db,
      enabled: true,
      userId: USER_ID,
    });
    await Promise.resolve();

    const retry = retryPendingEmailParseImprovementSampleDeletion({
      db,
      userId: USER_ID,
      now: new Date("2026-05-19T10:05:00.000Z"),
    });
    await Promise.resolve();

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledTimes(1);
    resolveDelete();
    await expect(optIn).resolves.toBeUndefined();
    await expect(retry).resolves.toEqual({ deleted: 0, retried: false });

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledTimes(1);
    expect(mockSetCaptureParseImprovementPreference).toHaveBeenCalledWith({
      enabled: true,
      userId: USER_ID,
    });
    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([]);
    sqlite.close();
  });

  it("blocks default-enabled flushes while an opt-out deletion request is pending", async () => {
    const { db, sqlite } = createDb();
    mockDeleteCaptureParseImprovementSamplesForUser.mockRejectedValueOnce(new Error("network"));

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("network");
    mockDeleteCaptureParseImprovementSamplesForUser.mockClear();

    const postOptOutRequest = {
      ...request,
      parserTemplate: "Nuevo pago en [MERCHANT] por [AMOUNT]",
      rawText: "Nuevo pago en Comercio por $123",
    };
    enqueueEmailParseImprovementRequests({
      db,
      userId: USER_ID,
      requests: [postOptOutRequest],
      now: new Date("2026-05-19T10:05:00.000Z"),
    });

    await expect(
      flushPendingEmailParseImprovementSamples({
        db,
        userId: USER_ID,
        now: new Date("2026-05-19T10:06:00.000Z"),
        canEnableRemotePreference: () => false,
      })
    ).resolves.toEqual({ shared: 0, failed: 0 });

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledTimes(1);
    expect(mockSetCaptureParseImprovementPreference).not.toHaveBeenCalled();
    expect(mockShareCaptureParseImprovementSample).not.toHaveBeenCalled();
    expect(countPendingEmailParseImprovementSamples({ db, userId: USER_ID })).toBe(1);
    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([]);
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

  it("preserves samples created after a failed opt-out request when retrying deletion", async () => {
    const { db, sqlite } = createDb();
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });
    mockDeleteCaptureParseImprovementSamplesForUser.mockRejectedValueOnce(new Error("network"));

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("network");

    const postOptInRequest = {
      ...request,
      parserTemplate: "Nuevo pago en [MERCHANT] por [AMOUNT]",
      rawText: "Nuevo pago en Comercio por $123",
    };
    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [postOptInRequest],
        now: new Date("2026-05-19T10:05:00.000Z"),
      })
    ).toBe(1);

    await expect(
      flushPendingEmailParseImprovementSamples({
        db,
        userId: USER_ID,
        now: new Date("2026-05-19T10:06:00.000Z"),
      })
    ).resolves.toMatchObject({ shared: 1, failed: 0 });

    expect(mockDeleteCaptureParseImprovementSamplesForUser).toHaveBeenCalledTimes(2);
    expect(mockSetCaptureParseImprovementPreference).toHaveBeenCalledWith({
      enabled: true,
      userId: USER_ID,
    });
    expect(db.select().from(emailParseImprovementSamples).all()).toEqual([
      expect.objectContaining({
        template: "Compra en [MERCHANT] por [AMOUNT]",
        deletedAt: "2026-05-19T10:00:00.000Z",
      }),
      expect.objectContaining({
        template: "Nuevo pago en [MERCHANT] por [AMOUNT]",
        sharedAt: "2026-05-19T10:06:00.000Z",
        deletedAt: null,
      }),
    ]);
    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([]);
    sqlite.close();
  });

  it("advances a pending deletion request when the user disables sharing again", async () => {
    const { db, sqlite } = createDb();
    mockDeleteCaptureParseImprovementSamplesForUser
      .mockRejectedValueOnce(new Error("first-network-failure"))
      .mockRejectedValueOnce(new Error("second-network-failure"));
    enqueueEmailParseImprovementRequests({ db, userId: USER_ID, requests: [request], now: NOW });

    await expect(
      deleteEmailParseImprovementSamplesForUser({ db, userId: USER_ID, now: NOW })
    ).rejects.toThrow("first-network-failure");

    const postOptInRequest = {
      ...request,
      parserTemplate: "Nuevo pago en [MERCHANT] por [AMOUNT]",
      rawText: "Nuevo pago en Comercio por $123",
    };
    expect(
      enqueueEmailParseImprovementRequests({
        db,
        userId: USER_ID,
        requests: [postOptInRequest],
        now: new Date("2026-05-19T10:05:00.000Z"),
      })
    ).toBe(1);

    await expect(
      deleteEmailParseImprovementSamplesForUser({
        db,
        userId: USER_ID,
        now: new Date("2026-05-19T10:10:00.000Z"),
      })
    ).rejects.toThrow("second-network-failure");

    expect(db.select().from(emailParseImprovementSamples).all()).toEqual([
      expect.objectContaining({
        template: "Compra en [MERCHANT] por [AMOUNT]",
        deletedAt: "2026-05-19T10:00:00.000Z",
      }),
      expect.objectContaining({
        template: "Nuevo pago en [MERCHANT] por [AMOUNT]",
        deletedAt: "2026-05-19T10:10:00.000Z",
      }),
    ]);
    expect(db.select().from(captureImprovementDeletionRequests).all()).toEqual([
      expect.objectContaining({
        requestedAt: "2026-05-19T10:10:00.000Z",
        lastAttemptAt: "2026-05-19T10:10:00.000Z",
      }),
    ]);
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

function runDrizzleSqlMigration(sqlite: Database.Database, fileName: string): void {
  const sql = readFileSync(resolve(__dirname, "../../drizzle", fileName), "utf8");
  sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .forEach((statement) => sqlite.exec(statement));
}
