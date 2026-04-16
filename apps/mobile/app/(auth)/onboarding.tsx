import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import * as SplashScreen from "expo-splash-screen";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ensureDefaultAccounts } from "@/features/accounts";
import { useAuthStore } from "@/features/auth";
import { useBudgetStore } from "@/features/budget";
import { useEmailCaptureStore } from "@/features/email-capture";
import {
  BudgetSetupStep,
  CompleteStep,
  ConnectEmailStep,
  StepIndicator,
  SyncProgressStep,
  TOTAL_STEPS,
  useOnboardingStore,
  WelcomeStep,
} from "@/features/onboarding";
import { useTransactionStore } from "@/features/transactions";
import { StyleSheet, View } from "@/shared/components/rn";
import { type AnyDb, getDb } from "@/shared/db";
import { useSubscription, useThemeColor } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import migrations from "../../drizzle/migrations";

const hasAuthenticatedUserId = (value: string | null): value is UserId => value != null;

function AuthenticatedOnboardingScreen({ db, userId }: { db: AnyDb; userId: UserId }) {
  const insets = useSafeAreaInsets();
  const step = useOnboardingStore((s) => s.step);
  const pageBg = useThemeColor("page");

  const [storesReady, setStoresReady] = useState(false);
  const { success: migrationsReady } = useMigrations(db, migrations);

  // Initialize minimal stores needed for onboarding
  useSubscription(
    () => {
      try {
        ensureDefaultAccounts(db, userId);
        useEmailCaptureStore.getState().initStore(db, userId);
        useTransactionStore.getState().initStore(db, userId);
        useBudgetStore.getState().initStore(db, userId);
        Promise.all([
          useEmailCaptureStore.getState().loadAccounts(),
          useTransactionStore.getState().loadInitialPage(),
        ])
          .catch(captureError)
          .finally(() => {
            setStoresReady(true);
          });
      } catch (error) {
        captureError(error);
        setStoresReady(true);
      }
    },
    [db, userId],
    migrationsReady && db != null && userId != null && !storesReady
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
    return <View style={[styles.container, { backgroundColor: pageBg }]} />;
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return <WelcomeStep />;
      case 2:
        return <ConnectEmailStep />;
      case 3:
        return <SyncProgressStep />;
      case 4:
        return <BudgetSetupStep />;
      case 5:
        return <CompleteStep />;
      default:
        return <WelcomeStep />;
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: pageBg, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />
      {renderStep()}
    </View>
  );
}

export default function OnboardingScreen() {
  const session = useAuthStore((s) => s.session);
  const pageBg = useThemeColor("page");
  const userId = session?.user.id ?? null;
  const db = userId ? getDb(userId) : null;

  if (!db || !hasAuthenticatedUserId(userId)) {
    return <View style={[styles.container, { backgroundColor: pageBg }]} />;
  }

  return <AuthenticatedOnboardingScreen db={db} userId={userId} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
