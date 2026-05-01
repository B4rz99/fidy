export const SYNC_EARLY_UNLOCK_FOUND_COUNT = 3;
export const SYNC_EARLY_UNLOCK_TIMEOUT_MS = 30_000;

type EmailSyncUnlockInput = {
  readonly foundCount: number;
  readonly elapsedMs: number;
  readonly isComplete: boolean;
};

export function shouldUnlockEmailSyncStep(input: EmailSyncUnlockInput): boolean {
  return (
    input.isComplete ||
    input.foundCount >= SYNC_EARLY_UNLOCK_FOUND_COUNT ||
    input.elapsedMs >= SYNC_EARLY_UNLOCK_TIMEOUT_MS
  );
}
