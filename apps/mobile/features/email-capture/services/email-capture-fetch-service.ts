import { createCaptureIngestionPort } from "@/features/capture-sources/ingestion.public";
import type { AnyDb } from "@/shared/db";
import { captureWarning, toIsoDateTime } from "@/shared/lib";
import { queryClient } from "@/shared/query";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";
import { isFirstFetchForAny, shouldShowProgress } from "../lib/progress-phases";
import type { EmailAccountRow, ProcessedEmailRow } from "../lib/repository";
import { getFailedEmails, getNeedsReviewEmails, updateLastFetchedAt } from "../lib/repository";
import type { ProgressCallback, RawEmail } from "../pipeline.public";
import { processEmails, processRetries } from "../pipeline.public";
import { ensureBankSenders } from "../queries/bank-senders";
import type { EmailProvider } from "../schema";
import { getAdapter } from "./email-adapter";

const EMPTY_RAW_EMAILS: RawEmail[] = [];
const FETCH_LOOKBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type EmailFetchClientIds = Record<EmailProvider, string>;

export type EmailAccountFetchResult = {
  readonly account: EmailAccountRow;
  readonly rawEmails: readonly RawEmail[];
  readonly fetchOk: boolean;
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
  readonly fetchResults: readonly EmailAccountFetchResult[];
};

const createEmptyFetchResult = (account: EmailAccountRow): EmailAccountFetchResult => ({
  account,
  rawEmails: EMPTY_RAW_EMAILS,
  fetchOk: false,
});

const createFetchLookbackBoundary = (): string =>
  new Date(Date.now() - FETCH_LOOKBACK_WINDOW_MS).toISOString();

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

const createSuccessfulAccountIds = (
  fetchResults: readonly EmailAccountFetchResult[]
): ReadonlySet<EmailAccountId> =>
  new Set(fetchResults.filter((result) => result.fetchOk).map((result) => result.account.id));

const getSuccessfulFetches = (
  fetchResults: readonly EmailAccountFetchResult[]
): readonly EmailAccountFetchResult[] => fetchResults.filter((result) => result.fetchOk);

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
      errorType: error instanceof Error ? error.message : "unknown",
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
      fetchEmailsForAccount({ account, clientIds: command.clientIds, senderEmails, minSince })
    )
  );

  return createFetchSummary(command.accounts, fetchResults);
}

export async function ingestFetchedEmails(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly emails: readonly RawEmail[];
  readonly onProgress?: ProgressCallback;
}): Promise<void> {
  const captureIngestion = createCaptureIngestionPort(input.db, {
    processEmails,
    processRetries,
  });

  if (input.emails.length > 0) {
    await captureIngestion.ingest({
      kind: "email_batch",
      userId: input.userId,
      emails: [...input.emails],
      onProgress: input.onProgress,
    });
  }

  await captureIngestion.ingest({
    kind: "email_retry",
    userId: input.userId,
  });
}

export async function persistFetchedAccounts(
  command: PersistFetchedAccountsCommand
): Promise<PersistedFetchedAccounts> {
  const successfulFetches = getSuccessfulFetches(command.fetchResults);
  const fetchedAt = toIsoDateTime(new Date());

  await Promise.all(
    successfulFetches.map((result) => updateLastFetchedAt(command.db, result.account.id, fetchedAt))
  );

  return {
    fetchedAt,
    updatedAccountIds: createSuccessfulAccountIds(command.fetchResults),
  };
}

export async function loadEmailCaptureQueues(db: AnyDb): Promise<EmailCaptureQueues> {
  const [failedEmails, needsReviewEmails] = await Promise.all([
    getFailedEmails(db),
    getNeedsReviewEmails(db),
  ]);

  return { failedEmails, needsReviewEmails };
}
