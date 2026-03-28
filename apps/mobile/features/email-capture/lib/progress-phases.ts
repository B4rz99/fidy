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

export const shouldShowProgress = (
  emailCount: number,
  isFirstFetch: boolean,
  threshold: number = 5
): boolean => isFirstFetch || emailCount >= threshold;

export const buildProgressDisplay = (
  phase: ProgressPhase,
  progress: ProgressData | null,
  _providerNames: readonly string[],
  t?: TranslateFn
): ProgressDisplay => {
  const base = { phase } as const;

  if (phase === "fetching") {
    return {
      ...base,
      title: t ? t("progress.fetchingTitle") : "Fetching your emails...",
      subtitle: t ? t("progress.fetchingSubtitle") : "Reading the last 30 days",
      fractionComplete: 0,
      transactionsFound: 0,
      needsReview: 0,
    };
  }

  const p = progress ?? { total: 0, completed: 0, saved: 0, failed: 0, needsReview: 0 };

  if (phase === "processing") {
    return {
      ...base,
      title: t ? t("progress.scanningTitle") : "Scanning emails...",
      subtitle: t
        ? t("progress.processingSubtitle", { completed: p.completed, total: p.total })
        : `${p.completed} of ${p.total}`,
      fractionComplete: p.total === 0 ? 0 : p.completed / p.total,
      transactionsFound: p.saved,
      needsReview: p.needsReview,
    };
  }

  // phase === "complete"
  const failedSuffix =
    p.failed > 0
      ? t
        ? t("progress.failedSuffix", { failed: p.failed })
        : ` (${p.failed} couldn't be read)`
      : "";
  return {
    ...base,
    title: t ? t("progress.completeTitle") : "Import complete!",
    subtitle: `${t ? t("progress.completeSubtitle", { saved: p.saved, total: p.total }) : `Found ${p.saved} transactions from ${p.total} emails`}${failedSuffix}`,
    fractionComplete: 1,
    transactionsFound: p.saved,
    needsReview: p.needsReview,
  };
};

export const shouldMorphToBanner = (needsReviewCount: number): boolean => needsReviewCount > 0;

export const isFirstFetchForAny = (
  accounts: readonly { lastFetchedAt?: string | null }[]
): boolean => accounts.some((a) => a.lastFetchedAt == null);
