import { describe, expect, it } from "vitest";
import type { RawEmail } from "@/features/email-capture/schema";
import {
  applyEmailCaptureCandidateLimit,
  resolveEmailCaptureSyncPolicy,
  sortFetchResultsByNewestEmail,
} from "@/features/email-capture/services/email-capture-sync-policy";

const makeEmail = (externalId: string, receivedAt: string): RawEmail => ({
  externalId,
  from: "alerts@example.com",
  subject: "Compra aprobada",
  body: "Compra por $50.000",
  receivedAt,
  provider: "gmail",
});

describe("email capture sync policy", () => {
  it("sorts account fetch results by newest email", () => {
    const older = { accountId: "older", rawEmails: [makeEmail("old", "2026-04-01T00:00:00Z")] };
    const empty = { accountId: "empty", rawEmails: [] };
    const newer = { accountId: "newer", rawEmails: [makeEmail("new", "2026-04-03T00:00:00Z")] };

    expect(
      sortFetchResultsByNewestEmail([older, empty, newer]).map((result) => result.accountId)
    ).toEqual(["newer", "older", "empty"]);
  });

  it("uses the maximum receivedAt within each account result when sorting", () => {
    const resultWithNewestFirst = {
      accountId: "first",
      rawEmails: [
        makeEmail("new", "2026-04-05T00:00:00Z"),
        makeEmail("old", "2026-04-01T00:00:00Z"),
      ],
    };
    const resultWithNewestLast = {
      accountId: "last",
      rawEmails: [
        makeEmail("old", "2026-04-01T00:00:00Z"),
        makeEmail("newer", "2026-04-06T00:00:00Z"),
      ],
    };
    const resultWithMiddleNewest = {
      accountId: "middle",
      rawEmails: [makeEmail("middle", "2026-04-03T00:00:00Z")],
    };

    expect(
      sortFetchResultsByNewestEmail([
        resultWithNewestFirst,
        resultWithNewestLast,
        resultWithMiddleNewest,
      ]).map((result) => result.accountId)
    ).toEqual(["last", "first", "middle"]);
  });

  it("sorts emails newest-first when no candidate limit is applied", () => {
    const results = [
      {
        accountId: "account-1",
        rawEmails: [
          makeEmail("old", "2026-04-01T00:00:00Z"),
          makeEmail("new", "2026-04-03T00:00:00Z"),
        ],
      },
    ];

    expect(
      applyEmailCaptureCandidateLimit(results, null)[0]?.rawEmails.map((email) => email.externalId)
    ).toEqual(["new", "old"]);
  });

  it("keeps only the newest cross-account candidate emails", () => {
    const results = [
      {
        accountId: "account-1",
        rawEmails: [
          makeEmail("old", "2026-04-01T00:00:00Z"),
          makeEmail("newest", "2026-04-04T00:00:00Z"),
        ],
      },
      {
        accountId: "account-2",
        rawEmails: [makeEmail("middle", "2026-04-03T00:00:00Z")],
      },
    ];

    const limited = applyEmailCaptureCandidateLimit(results, 2);

    expect(limited.map((result) => result.rawEmails.map((email) => email.externalId))).toEqual([
      ["newest"],
      ["middle"],
    ]);
  });

  it("resolves foreground, background, and initial sync policies", () => {
    expect(resolveEmailCaptureSyncPolicy(undefined)).toEqual({
      parseProfile: "foreground",
      advancesLastFetchedAt: true,
      maxCandidateEmails: null,
      runRetries: true,
      showsProgress: true,
    });
    expect(resolveEmailCaptureSyncPolicy("background")).toEqual({
      parseProfile: "background",
      advancesLastFetchedAt: false,
      maxCandidateEmails: null,
      runRetries: false,
      showsProgress: false,
    });
    expect(resolveEmailCaptureSyncPolicy("initial_sync")).toEqual({
      parseProfile: "initial_sync",
      advancesLastFetchedAt: false,
      maxCandidateEmails: null,
      runRetries: false,
      showsProgress: true,
    });
  });
});
