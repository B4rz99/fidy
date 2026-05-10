import type { RawEmail } from "../schema";

export type EmailCaptureParseProfile = "foreground" | "background" | "initial_sync";

export type EmailCaptureSyncPolicy = {
  readonly parseProfile: EmailCaptureParseProfile;
  readonly advancesLastFetchedAt: boolean;
  readonly maxCandidateEmails: number | null;
  readonly runRetries: boolean;
  readonly showsProgress: boolean;
};

type EmailBatchLike = {
  readonly rawEmails: readonly RawEmail[];
};

const sortNewestFirst = (emails: readonly RawEmail[]): readonly RawEmail[] =>
  [...emails].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));

const newestReceivedAt = (result: EmailBatchLike) =>
  result.rawEmails.reduce(
    // Identical timestamps are interchangeable for sorting; `>` and `>=` produce the same order here.
    // Stryker disable next-line EqualityOperator
    (newest, email) => (email.receivedAt > newest ? email.receivedAt : newest),
    ""
  );

export const sortFetchResultsByNewestEmail = <T extends EmailBatchLike>(
  fetchResults: readonly T[]
): readonly T[] =>
  [...fetchResults].sort((left, right) =>
    newestReceivedAt(right).localeCompare(newestReceivedAt(left))
  );

export const applyEmailCaptureCandidateLimit = <T extends EmailBatchLike>(
  fetchResults: readonly T[],
  maxCandidateEmails: number | null
): readonly T[] => {
  if (maxCandidateEmails == null) {
    return fetchResults.map((result) => ({
      ...result,
      rawEmails: sortNewestFirst(result.rawEmails),
    }));
  }

  const allowedExternalIds = new Set(
    sortNewestFirst(fetchResults.flatMap((result) => result.rawEmails))
      .slice(0, maxCandidateEmails)
      .map((email) => email.externalId)
  );

  return fetchResults.map((result) => ({
    ...result,
    rawEmails: sortNewestFirst(result.rawEmails).filter((email) =>
      allowedExternalIds.has(email.externalId)
    ),
  }));
};

export const resolveEmailCaptureSyncPolicy = (
  parseProfile: EmailCaptureParseProfile | undefined
): EmailCaptureSyncPolicy => {
  if (parseProfile === "background" || parseProfile === "initial_sync") {
    return {
      parseProfile,
      advancesLastFetchedAt: false,
      maxCandidateEmails: null,
      runRetries: false,
      showsProgress: parseProfile === "initial_sync",
    };
  }

  return {
    parseProfile: parseProfile ?? "foreground",
    advancesLastFetchedAt: true,
    maxCandidateEmails: null,
    runRetries: true,
    showsProgress: true,
  };
};
