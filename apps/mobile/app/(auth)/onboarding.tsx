import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import * as SplashScreen from "expo-splash-screen";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingAccountReviewStep } from "@/features/account-suggestions/routes.public";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import { initializeBudgetSession } from "@/features/budget/hooks.public";
import {
  initializeEmailCaptureSession,
  loadEmailAccounts,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { tryEnsureDefaultFinancialAccount } from "@/features/financial-accounts";
import {
  BudgetSetupStep,
  CompleteStep,
  ConnectEmailStep,
  getVisibleOnboardingStepCount,
  getVisibleOnboardingStepIndex,
  logOnboardingEvent,
  ONBOARDING_STEP,
  StepIndicator,
  SyncProgressStep,
  trackOnboardingEvent,
  useOnboardingStore,
  WelcomeStep,
} from "@/features/onboarding";
import type { OnboardingStep } from "@/features/onboarding/flow.public";
import {
  initializeTransactionSession,
  loadInitialTransactions,
  useTransactionStore,
} from "@/features/transactions";
import { AppAuroraBackground } from "@/shared/components";
import { StyleSheet, View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useColorScheme, useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import migrations from "../../drizzle/migrations";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const isDark = useColorScheme() === "dark";

  if (!userId) {
    return (
      <View style={styles.container}>
        <AppAuroraBackground isDark={isDark} />
      </View>
    );
  }

  return <AuthenticatedOnboardingScreen insets={insets} userId={userId} />;
}

function AuthenticatedOnboardingScreen({
  insets,
  userId,
}: {
  readonly insets: { top: number; bottom: number };
  readonly userId: UserId;
}) {
  const step = useOnboardingStore((s) => s.step);
  const shouldReviewAccounts = useOnboardingStore((s) => s.shouldReviewAccounts);
  const isDark = useColorScheme() === "dark";
  const [storesReady, setStoresReady] = useState(false);
  const db = getDb(userId);
  const { success: migrationsReady } = useMigrations(db, migrations);

  // Initialize minimal stores needed for onboarding
  useSubscription(
    () => {
      logOnboardingEvent("init_start", { migrationsReady });
      void Promise.resolve()
        .then(() => {
          initializeEmailCaptureSession(userId);
          initializeTransactionSession(userId);
          const defaultAccount = tryEnsureDefaultFinancialAccount(db, userId);
          if (defaultAccount) {
            useTransactionStore.getState().setDefaultAccountId(defaultAccount.id);
          }
          initializeBudgetSession(userId);
          return Promise.all([loadEmailAccounts(db, userId), loadInitialTransactions(db, userId)]);
        })
        .then(() => {
          trackOnboardingEvent("init_complete", {
            emailAccounts: useEmailCaptureStore.getState().accounts.length,
            transactionPreviewCount: useTransactionStore.getState().pages.slice(0, 3).length,
          });
        })
        .catch((error) => {
          logOnboardingEvent("init_failed", {
            errorType: error instanceof Error ? error.name : "unknown",
          });
          captureError(error);
        })
        .finally(() => {
          setStoresReady(true);
        });
    },
    [db, userId],
    migrationsReady && !storesReady
  );

  // Hide splash once ready
  useSubscription(
    () => {
      void SplashScreen.hideAsync();
    },
    [],
    storesReady
  );

  if (!storesReady) {
    return (
      <View style={styles.container}>
        <AppAuroraBackground isDark={isDark} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <AppAuroraBackground isDark={isDark} />
      <StepIndicator
        currentStep={getVisibleOnboardingStepIndex(step, shouldReviewAccounts)}
        totalSteps={getVisibleOnboardingStepCount(shouldReviewAccounts)}
      />
      <OnboardingStepContent step={step} />
    </View>
  );
}

function OnboardingStepContent({ step }: { readonly step: OnboardingStep }) {
  switch (step) {
    case ONBOARDING_STEP.welcome:
      return <WelcomeStep />;
    case ONBOARDING_STEP.connectEmail:
      return <ConnectEmailStep />;
    case ONBOARDING_STEP.sync:
      return <SyncProgressStep />;
    case ONBOARDING_STEP.accountReview:
      return <OnboardingAccountReviewStep />;
    case ONBOARDING_STEP.budgetSetup:
      return <BudgetSetupStep />;
    case ONBOARDING_STEP.complete:
      return <CompleteStep />;
    default:
      return <WelcomeStep />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
