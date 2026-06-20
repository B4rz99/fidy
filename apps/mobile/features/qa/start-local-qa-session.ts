import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";
import { initializeBudgetSession, loadBudgetsForUser } from "@/features/budget/public";
import { useCaptureSourcesStore } from "@/features/capture-sources/store.public";
import { useEmailCaptureStore } from "@/features/email-capture/public";
import { upsertFinancialAccount } from "@/features/financial-accounts/write.public";
import { clearOnboardingFromStore } from "@/features/onboarding/store.public";
import { useLocalOnboardingState } from "@/features/onboarding/store.public";
import { useOnboardingStore } from "@/features/onboarding/store.public";
import { useSettingsStore } from "@/features/settings/public";
import {
  initializeTransactionSession,
  loadInitialTransactions,
} from "@/features/transactions/store.public";
import { seedLocalLedgerRowsForQa } from "@/infrastructure/local-ledger/public";
import { type AnyDb, getDb, resetDbForUser } from "@/shared/db";
import { captureEvidence, processedSourceEvents } from "@/shared/db/schema";
import { queryClient } from "@/shared/query/client";
import { buildLocalQaSeed } from "./lib/build-local-qa-seed";
import {
  buildQaNeedsReviewEmailSourceEvents,
  seedHomeActivityAttributionReviewRows,
} from "./lib/home-activity-review-seed";
import { type LocalQaProfile, persistLocalQaSession } from "./local-session";

function seedHomeActivityReviewState(
  db: AnyDb,
  seed: ReturnType<typeof buildLocalQaSeed>,
  now: Date
) {
  useEmailCaptureStore
    .getState()
    .setNeedsReviewEmailSourceEvents(
      buildQaNeedsReviewEmailSourceEvents({ userId: seed.session.userId, now })
    );
  useCaptureSourcesStore.getState().setDetectedSmsCount(3);

  const attributionReviewRows = seedHomeActivityAttributionReviewRows({
    userId: seed.session.userId,
    transactions: seed.transactions,
    now,
  });
  if (!attributionReviewRows) return;

  db.insert(processedSourceEvents)
    .values([...attributionReviewRows.sourceEvents])
    .onConflictDoNothing()
    .run();
  db.insert(captureEvidence)
    .values([...attributionReviewRows.evidenceRows])
    .onConflictDoNothing()
    .run();
}

export async function startLocalQaSession(profile: LocalQaProfile = "default") {
  const now = new Date();
  const seed = buildLocalQaSeed(profile, now);

  await clearOnboardingFromStore();
  useLocalOnboardingState.getState().setIsComplete(false);
  useOnboardingStore.getState().reset();
  queryClient.clear();
  useEmailCaptureStore.getState().beginSession(seed.session.userId);
  useCaptureSourcesStore.getState().setDetectedSmsCount(0);
  useSettingsStore.getState().setNotificationPreferenceForSession("budgetAlerts", false);

  await resetDbForUser(seed.session.userId);

  const db = getDb(seed.session.userId);
  await migrate(db, migrations);

  seed.financialAccounts.forEach((account) => {
    upsertFinancialAccount(db, account);
  });
  seedLocalLedgerRowsForQa(db, {
    budgets: seed.budgets,
    transactions: seed.transactions,
    transfers: seed.transfers,
  });
  if (profile === "home-activity") {
    seedHomeActivityReviewState(db, seed, now);
  }
  initializeTransactionSession(seed.session.userId);
  initializeBudgetSession(seed.session.userId);
  await Promise.all([
    loadInitialTransactions(db, seed.session.userId),
    loadBudgetsForUser(db, seed.session.userId),
  ]);

  await persistLocalQaSession(seed.session);

  return seed.session;
}
