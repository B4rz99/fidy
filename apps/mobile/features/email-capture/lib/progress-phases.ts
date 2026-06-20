// apps/mobile/features/email-capture/lib/progress-phases.ts

export type ProgressPhase = "fetching" | "processing" | "complete";

export const shouldShowProgress = (
  emailCount: number,
  isFirstFetch: boolean,
  threshold: number = 5
): boolean => isFirstFetch || emailCount >= threshold;

export const isFirstFetchForAny = (
  accounts: readonly { lastFetchedAt?: string | null }[]
): boolean => accounts.some((a) => a.lastFetchedAt == null);
