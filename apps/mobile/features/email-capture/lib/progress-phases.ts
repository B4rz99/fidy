// apps/mobile/features/email-capture/lib/progress-phases.ts

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
  _providerNames: ReadonlyArray<string>
): ProgressDisplay => {
  const base = { phase } as const;

  if (phase === "fetching") {
    return {
      ...base,
      title: "Fetching your emails...",
      subtitle: "Reading the last 30 days",
      fractionComplete: 0,
      transactionsFound: 0,
      needsReview: 0,
    };
  }

  const p = progress ?? { total: 0, completed: 0, saved: 0, failed: 0, needsReview: 0 };

  if (phase === "processing") {
    return {
      ...base,
      title: "Scanning emails...",
      subtitle: `${p.completed} of ${p.total}`,
      fractionComplete: p.total === 0 ? 0 : p.completed / p.total,
      transactionsFound: p.saved,
      needsReview: p.needsReview,
    };
  }

  // phase === "complete"
  const failedSuffix = p.failed > 0 ? ` (${p.failed} couldn't be read)` : "";
  return {
    ...base,
    title: "Import complete!",
    subtitle: `Found ${p.saved} transactions from ${p.total} emails${failedSuffix}`,
    fractionComplete: 1,
    transactionsFound: p.saved,
    needsReview: p.needsReview,
  };
};

export const shouldMorphToBanner = (needsReviewCount: number): boolean => needsReviewCount > 0;

export const isFirstFetchForAny = (
  accounts: ReadonlyArray<{ lastFetchedAt: string | null }>
): boolean => accounts.some((a) => a.lastFetchedAt === null);
