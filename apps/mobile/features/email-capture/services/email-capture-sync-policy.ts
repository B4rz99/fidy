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
): EmailCaptureSyncPolicy =>
  parseProfile === "background"
    ? {
        parseProfile,
        advancesLastFetchedAt: false,
        maxCandidateEmails: null,
        runRetries: false,
        showsProgress: false,
      }
    : parseProfile === "initial_sync"
      ? {
          parseProfile,
          advancesLastFetchedAt: false,
          maxCandidateEmails: null,
          runRetries: false,
          showsProgress: true,
        }
      : {
          parseProfile: parseProfile ?? "foreground",
          advancesLastFetchedAt: true,
          maxCandidateEmails: null,
          runRetries: true,
          showsProgress: true,
        };
