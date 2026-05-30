import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";
import {
  initializeBudgetSession,
  insertBudget,
  loadBudgetsForUser,
} from "@/features/budget/public";
import { useCaptureSourcesStore } from "@/features/capture-sources/public";
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
import { getDb, resetDbForUser } from "@/shared/db";
import { queryClient } from "@/shared/query/client";
import { buildLocalQaSeed } from "./lib/build-local-qa-seed";
import {
  buildQaNeedsReviewEmailSourceEvents,
  seedHomeActivityAttributionReviewRows,
} from "./lib/home-activity-review-seed";
import { type LocalQaProfile, persistLocalQaSession } from "./local-session";

export async function startLocalQaSession(profile: LocalQaProfile = "default") {
  const now = new Date();
  const seed = buildLocalQaSeed(profile, now);

  await clearOnboardingFromStore();
  useLocalOnboardingState.getState().setIsComplete(false);
  useOnboardingStore.getState().reset();
  queryClient.clear();
  useEmailCaptureStore.getState().beginSession(seed.session.userId);
  useCaptureSourcesStore.getState().setDetectedSmsCount(0);
  useSettingsStore.getState().setNotificationPreference("budgetAlerts", false);

  await resetDbForUser(seed.session.userId);

  const db = getDb(seed.session.userId);
  await migrate(db, migrations);

  seed.financialAccounts.forEach((account) => {
    upsertFinancialAccount(db, account);
  });
  seed.budgets.forEach((budget) => {
    insertBudget(db, budget);
  });
  seedLocalLedgerRowsForQa(db, {
    transactions: seed.transactions,
    transfers: seed.transfers,
  });
  if (profile === "home-activity") {
    useEmailCaptureStore
      .getState()
      .setNeedsReviewEmailSourceEvents(
        buildQaNeedsReviewEmailSourceEvents({ userId: seed.session.userId, now })
      );
    useCaptureSourcesStore.getState().setDetectedSmsCount(3);
    seedHomeActivityAttributionReviewRows({
      db,
      userId: seed.session.userId,
      transactions: seed.transactions,
      now,
    });
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
