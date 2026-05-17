import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";
import { upsertFinancialAccount } from "@/features/financial-accounts/write.public";
import { clearOnboardingFromStore } from "@/features/onboarding/store.public";
import { useLocalOnboardingState } from "@/features/onboarding/store.public";
import { useOnboardingStore } from "@/features/onboarding/store.public";
import { seedLocalLedgerRowsForQa } from "@/infrastructure/local-ledger/public";
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
  seedLocalLedgerRowsForQa(db, {
    transactions: seed.transactions,
    transfers: seed.transfers,
  });

  await persistLocalQaSession(seed.session);

  return seed.session;
}
