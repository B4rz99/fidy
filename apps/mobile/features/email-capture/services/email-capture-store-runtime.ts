import type { UserId } from "@/shared/types/branded";
import type { ProgressPhase } from "../lib/progress-phases";
import type { ProgressCallback } from "../pipeline.public";

type ProgressSnapshot = Parameters<ProgressCallback>[0];
type RefreshTransactions = () => Promise<void> | void;

type EmailCaptureRequestKind = "accounts" | "failedEmails" | "needsReview" | "fetch";

type RequestCounters = Record<EmailCaptureRequestKind, number>;

type StoreRuntime = {
  beginSession(userId: UserId): void;
  getActiveUserId(): UserId | null;
  getIsFetching(): boolean;
  getPhase(): ProgressPhase | null;
  setIsFetching(isFetching: boolean): void;
  setPhase(phase: ProgressPhase | null): void;
  setProgress(progress: ProgressSnapshot | null): void;
};

type FetchStartResult =
  | { readonly kind: "ready"; readonly run: EmailCaptureFetchRun }
  | { readonly kind: "missing_context" }
  | { readonly kind: "already_fetching" };

type FetchProgressRuntime = {
  readonly run: EmailCaptureFetchRun;
  readonly refreshTransactions: RefreshTransactions;
  lastRefreshedSaved: number;
};

export type EmailCaptureSession = {
  readonly userId: UserId;
  readonly sessionId: number;
};

export type EmailCaptureRequest = EmailCaptureSession & {
  readonly kind: Exclude<EmailCaptureRequestKind, "fetch">;
  readonly requestId: number;
};

export type EmailCaptureFetchRun = EmailCaptureSession & {
  readonly kind: "fetch";
  readonly requestId: number;
};

const COMPLETE_STATE_CLEAR_DELAY_MS = 2000;
const ZERO_PROGRESS_SNAPSHOT: ProgressSnapshot = {
  total: 0,
  completed: 0,
  saved: 0,
  failed: 0,
  needsReview: 0,
};

let runtime: StoreRuntime | null = null;
let sessionId = 0;
let requestCounters: RequestCounters = {
  accounts: 0,
  failedEmails: 0,
  needsReview: 0,
  fetch: 0,
};
let autoClearTimer: ReturnType<typeof setTimeout> | null = null;

const getRuntime = (): StoreRuntime => {
  if (runtime) return runtime;
  throw new Error("Email capture store runtime not registered");
};

const incrementRequestCounters = (current: RequestCounters): RequestCounters => ({
  accounts: current.accounts + 1,
  failedEmails: current.failedEmails + 1,
  needsReview: current.needsReview + 1,
  fetch: current.fetch + 1,
});

const nextRequestId = (kind: EmailCaptureRequestKind): number => {
  requestCounters[kind] += 1;
  return requestCounters[kind];
};

const clearAutoClearTimer = (): void => {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
};

const clearFetchState = (): void => {
  const currentRuntime = getRuntime();
  currentRuntime.setIsFetching(false);
  currentRuntime.setPhase(null);
  currentRuntime.setProgress(null);
};

const scheduleCompletedFetchClear = (run: EmailCaptureFetchRun): void => {
  clearAutoClearTimer();
  autoClearTimer = setTimeout(() => {
    autoClearTimer = null;
    if (!isCurrentEmailCaptureFetchRun(run)) return;
    if (getRuntime().getPhase() !== "complete") return;
    getRuntime().setPhase(null);
    getRuntime().setProgress(null);
  }, COMPLETE_STATE_CLEAR_DELAY_MS);
};

const applyFetchProgress = (
  progressRuntime: FetchProgressRuntime,
  progress: ProgressSnapshot
): void => {
  if (!isCurrentEmailCaptureFetchRun(progressRuntime.run)) return;

  getRuntime().setProgress(progress);
  if (progress.saved <= progressRuntime.lastRefreshedSaved) return;
  progressRuntime.lastRefreshedSaved = progress.saved;
  void progressRuntime.refreshTransactions();
};

export function registerEmailCaptureStoreRuntime(nextRuntime: StoreRuntime): void {
  runtime = nextRuntime;
}

export function createEmailCaptureSession(userId: UserId): EmailCaptureSession {
  return { userId, sessionId };
}

export function isActiveEmailCaptureSession(session: EmailCaptureSession): boolean {
  return sessionId === session.sessionId && getRuntime().getActiveUserId() === session.userId;
}

export function beginEmailCaptureRequest(
  kind: EmailCaptureRequest["kind"],
  userId: UserId
): EmailCaptureRequest {
  return { kind, ...createEmailCaptureSession(userId), requestId: nextRequestId(kind) };
}

export function isCurrentEmailCaptureRequest(request: EmailCaptureRequest): boolean {
  return (
    requestCounters[request.kind] === request.requestId && isActiveEmailCaptureSession(request)
  );
}

export function initializeEmailCaptureStoreSession(userId: UserId): void {
  clearAutoClearTimer();
  sessionId += 1;
  requestCounters = incrementRequestCounters(requestCounters);
  getRuntime().beginSession(userId);
}

export function beginEmailCaptureFetchRun(userId: UserId): FetchStartResult {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) {
    return { kind: "missing_context" };
  }
  if (getRuntime().getIsFetching()) {
    return { kind: "already_fetching" };
  }

  clearAutoClearTimer();
  getRuntime().setIsFetching(true);
  getRuntime().setPhase(null);
  getRuntime().setProgress(null);
  return { kind: "ready", run: { kind: "fetch", ...session, requestId: nextRequestId("fetch") } };
}

export function applyEmailCaptureFetchSummary(input: {
  readonly run: EmailCaptureFetchRun;
  readonly showProgress: boolean;
  readonly emailCount: number;
}): void {
  if (!input.showProgress || !isCurrentEmailCaptureFetchRun(input.run)) return;
  if (input.emailCount === 0) {
    getRuntime().setPhase("complete");
    getRuntime().setProgress(ZERO_PROGRESS_SNAPSHOT);
    return;
  }
  getRuntime().setPhase("processing");
}

export function createEmailCaptureFetchProgressHandler(
  run: EmailCaptureFetchRun,
  refreshTransactions: RefreshTransactions
): ProgressCallback {
  const progressRuntime: FetchProgressRuntime = {
    run,
    refreshTransactions,
    lastRefreshedSaved: 0,
  };

  return (progress) => applyFetchProgress(progressRuntime, progress);
}

export function isCurrentEmailCaptureFetchRun(run: EmailCaptureFetchRun): boolean {
  return requestCounters.fetch === run.requestId && isActiveEmailCaptureSession(run);
}

export function finalizeEmailCaptureFetchRun(run: EmailCaptureFetchRun): void {
  if (!isCurrentEmailCaptureFetchRun(run)) return;
  if (getRuntime().getPhase() !== "complete") {
    clearFetchState();
    return;
  }

  getRuntime().setIsFetching(false);
  scheduleCompletedFetchClear(run);
}
