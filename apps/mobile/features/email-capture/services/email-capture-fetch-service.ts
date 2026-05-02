import { createCaptureIngestionPort } from "@/features/capture-sources/ingestion.public";
import type { AnyDb } from "@/shared/db";
import { captureWarning, toIsoDateTime } from "@/shared/lib";
import { queryClient } from "@/shared/query";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";
import { isFirstFetchForAny, shouldShowProgress } from "../lib/progress-phases";
import type { EmailAccountRow, ProcessedEmailRow } from "../lib/repository";
import { getFailedEmails, getNeedsReviewEmails, updateLastFetchedAt } from "../lib/repository";
import type { PipelineResult, ProgressCallback, RawEmail } from "../pipeline.public";
import {
  processBackgroundEmails,
  processEmails,
  processInitialSyncEmails,
  processRetries,
} from "../pipeline.public";
import { ensureBankSenders } from "../queries/bank-senders";
import type { EmailProvider } from "../schema";
import type { EmailCaptureParseProfile } from "./email-capture-sync-policy";
import { getAdapter } from "./email-adapter";
export {
  applyEmailCaptureCandidateLimit,
  type EmailCaptureParseProfile,
  resolveEmailCaptureSyncPolicy,
  sortFetchResultsByNewestEmail,
} from "./email-capture-sync-policy";

const EMPTY_RAW_EMAILS: RawEmail[] = [];
const EMPTY_PIPELINE_RESULT: PipelineResult = {
  filtered: 0,
  skippedDuplicate: 0,
  skippedCrossSource: 0,
  saved: 0,
  failed: 0,
  pendingRetry: 0,
  needsReview: 0,
};
const FETCH_LOOKBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type EmailFetchClientIds = Record<EmailProvider, string>;

export type EmailAccountFetchResult = {
  readonly account: EmailAccountRow;
  readonly rawEmails: readonly RawEmail[];
  readonly fetchOk: boolean;
};

export type ProcessedEmailAccountFetchResult = EmailAccountFetchResult & {
  readonly processingResult: PipelineResult;
};

export type EmailCaptureFetchSummary = {
  readonly fetchResults: readonly EmailAccountFetchResult[];
  readonly allEmails: readonly RawEmail[];
  readonly showProgress: boolean;
};

export type PersistedFetchedAccounts = {
  readonly fetchedAt: IsoDateTime;
  readonly updatedAccountIds: ReadonlySet<EmailAccountId>;
};

export type EmailCaptureQueues = {
  readonly failedEmails: readonly ProcessedEmailRow[];
  readonly needsReviewEmails: readonly ProcessedEmailRow[];
};

type FetchEmailAccountsCommand = {
  readonly accounts: readonly EmailAccountRow[];
  readonly clientIds: EmailFetchClientIds;
};

type FetchEmailAccountCommand = {
  readonly account: EmailAccountRow;
  readonly clientIds: EmailFetchClientIds;
  readonly senderEmails: readonly string[];
  readonly minSince: string;
};

type PersistFetchedAccountsCommand = {
  readonly db: AnyDb;
  readonly fetchResults: readonly ProcessedEmailAccountFetchResult[];
};

const createEmptyFetchResult = (account: EmailAccountRow): EmailAccountFetchResult => ({
  account,
  rawEmails: EMPTY_RAW_EMAILS,
  fetchOk: false,
});

const createFetchLookbackBoundary = (): string =>
  new Date(Date.now() - FETCH_LOOKBACK_WINDOW_MS).toISOString();

export const summarizeFetchedEmailDiagnostics = (
  fetchResults: readonly EmailAccountFetchResult[]
) => ({
  totalEmails: fetchResults.reduce((total, result) => total + result.rawEmails.length, 0),
  accounts: fetchResults.map((result) => ({
    provider: result.account.provider,
    fetchOk: result.fetchOk,
    emailCount: result.rawEmails.length,
  })),
});

function logFetchedEmailDiagnostics(fetchResults: readonly EmailAccountFetchResult[]) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;

  console.info("[email-capture] fetch_batch", summarizeFetchedEmailDiagnostics(fetchResults));
}

const createFetchSummary = (
  accounts: readonly EmailAccountRow[],
  fetchResults: readonly EmailAccountFetchResult[]
): EmailCaptureFetchSummary => {
  const allEmails = fetchResults.flatMap((result) => result.rawEmails);
  return {
    fetchResults,
    allEmails,
    showProgress: shouldShowProgress(allEmails.length, isFirstFetchForAny(accounts)),
  };
};

const getDurablyProcessedFetches = (
  fetchResults: readonly ProcessedEmailAccountFetchResult[]
): readonly ProcessedEmailAccountFetchResult[] =>
  fetchResults.filter(
    (result) =>
      result.fetchOk &&
      (result.processingResult.failed === 0 ||
        result.processingResult.failed === result.processingResult.pendingRetry)
  );

export const aggregatePipelineResults = (results: readonly PipelineResult[]): PipelineResult =>
  results.reduce(
    (total, result) => ({
      filtered: total.filtered + result.filtered,
      skippedDuplicate: total.skippedDuplicate + result.skippedDuplicate,
      skippedCrossSource: total.skippedCrossSource + result.skippedCrossSource,
      saved: total.saved + result.saved,
      failed: total.failed + result.failed,
      pendingRetry: total.pendingRetry + result.pendingRetry,
      needsReview: total.needsReview + result.needsReview,
    }),
    EMPTY_PIPELINE_RESULT
  );

const isSupportedEmailProvider = (provider: string): provider is EmailProvider =>
  provider === "gmail" || provider === "outlook";

const resolveFetchSince = (account: EmailAccountRow, minSince: string): string =>
  account.lastFetchedAt && account.lastFetchedAt > minSince ? account.lastFetchedAt : minSince;

const loadSenderEmails = async (): Promise<readonly string[]> => {
  const senders = await ensureBankSenders(queryClient);
  return senders.map((sender) => sender.email);
};

async function fetchEmailsForAccount(
  command: FetchEmailAccountCommand
): Promise<EmailAccountFetchResult> {
  if (!isSupportedEmailProvider(command.account.provider)) {
    return createEmptyFetchResult(command.account);
  }

  try {
    const provider = command.account.provider;
    const rawEmails = await getAdapter(provider).fetchEmails(
      command.clientIds[provider],
      resolveFetchSince(command.account, command.minSince),
      [...command.senderEmails]
    );

    return { account: command.account, rawEmails, fetchOk: true };
  } catch (error) {
    captureWarning("email_adapter_fetch_failed", {
      provider: command.account.provider,
      errorType: error instanceof Error ? error.name : "unknown",
    });

    return createEmptyFetchResult(command.account);
  }
}

export const createEmailFetchClientIds = (
  gmailClientId: string,
  outlookClientId: string
): EmailFetchClientIds => ({
  gmail: gmailClientId,
  outlook: outlookClientId,
});

export async function fetchEmailAccountBatch(
  command: FetchEmailAccountsCommand
): Promise<EmailCaptureFetchSummary> {
  const senderEmails = await loadSenderEmails();
  const minSince = createFetchLookbackBoundary();
  const fetchResults = await Promise.all(
    command.accounts.map((account) =>
      fetchEmailsForAccount({
        account,
        clientIds: command.clientIds,
        senderEmails,
        minSince,
      })
    )
  );
  logFetchedEmailDiagnostics(fetchResults);

  return createFetchSummary(command.accounts, fetchResults);
}

export async function ingestFetchedEmails(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly emails: readonly RawEmail[];
  readonly onProgress?: ProgressCallback;
  readonly runRetries?: boolean;
  readonly parseProfile?: EmailCaptureParseProfile;
}): Promise<PipelineResult> {
  const processEmailsForProfile =
    input.parseProfile === "initial_sync"
      ? processInitialSyncEmails
      : input.parseProfile === "background"
        ? processBackgroundEmails
        : processEmails;
  const captureIngestion = createCaptureIngestionPort(input.db, {
    processEmails: processEmailsForProfile,
    processRetries,
  });

  const processingResult: PipelineResult =
    input.emails.length > 0
      ? ((await captureIngestion.ingest({
          kind: "email_batch",
          userId: input.userId,
          emails: [...input.emails],
          onProgress: input.onProgress,
        })) as PipelineResult)
      : EMPTY_PIPELINE_RESULT;

  if (input.runRetries !== false) {
    await captureIngestion.ingest({
      kind: "email_retry",
      userId: input.userId,
    });
  }

  return processingResult;
}

export async function persistFetchedAccounts(
  command: PersistFetchedAccountsCommand
): Promise<PersistedFetchedAccounts> {
  const successfulFetches = getDurablyProcessedFetches(command.fetchResults);
  const fetchedAt = toIsoDateTime(new Date());

  await Promise.all(
    successfulFetches.map((result) => updateLastFetchedAt(command.db, result.account.id, fetchedAt))
  );

  return {
    fetchedAt,
    updatedAccountIds: new Set(successfulFetches.map((result) => result.account.id)),
  };
}

export async function loadEmailCaptureQueues(db: AnyDb): Promise<EmailCaptureQueues> {
  const [failedEmails, needsReviewEmails] = await Promise.all([
    getFailedEmails(db),
    getNeedsReviewEmails(db),
  ]);

  return { failedEmails, needsReviewEmails };
}
