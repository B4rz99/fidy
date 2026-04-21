// apps/mobile/features/email-capture/lib/progress-phases.ts

import type { TranslateFn } from "@/shared/i18n/types";

export type ProgressPhase = "fetching" | "processing" | "complete";

export type ProgressDisplay = {
  readonly phase: ProgressPhase;
  readonly title: string;
  readonly subtitle: string;
  readonly fractionComplete: number;
  readonly transactionsFound: number;
  readonly needsReview: number;
};

type ProgressData = {
  readonly total: number;
  readonly completed: number;
  readonly saved: number;
  readonly failed: number;
  readonly needsReview: number;
};
type ProgressDisplayBuilderInput = {
  readonly phase: ProgressPhase;
  readonly progress: ProgressData;
  readonly t?: TranslateFn;
};

const EMPTY_PROGRESS_DATA: ProgressData = {
  total: 0,
  completed: 0,
  saved: 0,
  failed: 0,
  needsReview: 0,
};

export const shouldShowProgress = (
  emailCount: number,
  isFirstFetch: boolean,
  threshold: number = 5
): boolean => isFirstFetch || emailCount >= threshold;

function buildFetchingDisplay({ phase, t }: ProgressDisplayBuilderInput): ProgressDisplay {
  return {
    phase,
    title: t ? t("progress.fetchingTitle") : "Fetching your emails...",
    subtitle: t ? t("progress.fetchingSubtitle") : "Reading the last 30 days",
    fractionComplete: 0,
    transactionsFound: 0,
    needsReview: 0,
  };
}

function buildProcessingSubtitle(progress: ProgressData, t?: TranslateFn): string {
  return t
    ? t("progress.processingSubtitle", {
        completed: progress.completed,
        total: progress.total,
      })
    : `${progress.completed} of ${progress.total}`;
}

function buildProcessingDisplay({
  phase,
  progress,
  t,
}: ProgressDisplayBuilderInput): ProgressDisplay {
  return {
    phase,
    title: t ? t("progress.scanningTitle") : "Scanning emails...",
    subtitle: buildProcessingSubtitle(progress, t),
    fractionComplete: progress.total === 0 ? 0 : progress.completed / progress.total,
    transactionsFound: progress.saved,
    needsReview: progress.needsReview,
  };
}

function buildFailedSuffix(progress: ProgressData, t?: TranslateFn): string {
  if (progress.failed === 0) {
    return "";
  }

  return t
    ? t("progress.failedSuffix", { failed: progress.failed })
    : ` (${progress.failed} couldn't be read)`;
}

function buildCompleteSubtitle(progress: ProgressData, t?: TranslateFn): string {
  const base = t
    ? t("progress.completeSubtitle", { saved: progress.saved, total: progress.total })
    : `Found ${progress.saved} transactions from ${progress.total} emails`;
  return `${base}${buildFailedSuffix(progress, t)}`;
}

function buildCompleteDisplay({
  phase,
  progress,
  t,
}: ProgressDisplayBuilderInput): ProgressDisplay {
  return {
    phase,
    title: t ? t("progress.completeTitle") : "Import complete!",
    subtitle: buildCompleteSubtitle(progress, t),
    fractionComplete: 1,
    transactionsFound: progress.saved,
    needsReview: progress.needsReview,
  };
}

export const buildProgressDisplay = (
  phase: ProgressPhase,
  progress: ProgressData | null,
  _providerNames: readonly string[],
  t?: TranslateFn
): ProgressDisplay =>
  ({
    fetching: buildFetchingDisplay,
    processing: buildProcessingDisplay,
    complete: buildCompleteDisplay,
  })[phase]({
    phase,
    progress: progress ?? EMPTY_PROGRESS_DATA,
    t,
  });

export const shouldMorphToBanner = (needsReviewCount: number): boolean => needsReviewCount > 0;

export const isFirstFetchForAny = (
  accounts: readonly { lastFetchedAt?: string | null }[]
): boolean => accounts.some((a) => a.lastFetchedAt == null);
