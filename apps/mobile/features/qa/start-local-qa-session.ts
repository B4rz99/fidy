import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";
import { upsertFinancialAccount } from "@/features/financial-accounts/lib/repository";
import { clearOnboardingFromStore } from "@/features/onboarding/lib/check-onboarding";
import { useLocalOnboardingState } from "@/features/onboarding/lib/local-onboarding-state";
import { useOnboardingStore } from "@/features/onboarding/store";
import { insertTransaction } from "@/features/transactions/lib/repository";
import { upsertTransfer } from "@/features/transfers/lib/repository";
import { getDb, resetDbForUser } from "@/shared/db";
import { queryClient } from "@/shared/query/client";
import { buildLocalQaSeed } from "./lib/build-local-qa-seed";
import { type LocalQaProfile, persistLocalQaSession } from "./local-session";

export async function startLocalQaSession(profile: LocalQaProfile = "default") {
  const seed = buildLocalQaSeed(profile, new Date());

  await clearOnboardingFromStore();
  useLocalOnboardingState.getState().setIsComplete(false);
  useOnboardingStore.getState().reset();
  queryClient.clear();

  await resetDbForUser(seed.session.userId);

  const db = getDb(seed.session.userId);
  await migrate(db, migrations);

  seed.financialAccounts.forEach((account) => {
    upsertFinancialAccount(db, account);
  });
  seed.transactions.forEach((transaction) => {
    insertTransaction(db, transaction);
  });
  seed.transfers.forEach((transfer) => {
    upsertTransfer(db, transfer);
  });

  await persistLocalQaSession(seed.session);

  return seed.session;
}
