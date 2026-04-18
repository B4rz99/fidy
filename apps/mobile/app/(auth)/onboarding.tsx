import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import * as SplashScreen from "expo-splash-screen";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth";
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
import { getDb } from "@/shared/db";
import { useSubscription, useThemeColor } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import migrations from "../../drizzle/migrations";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const pageBg = useThemeColor("page");

  if (!userId) {
    return <View style={[styles.container, { backgroundColor: pageBg }]} />;
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
  const pageBg = useThemeColor("page");
  const [storesReady, setStoresReady] = useState(false);
  const db = getDb(userId);
  const { success: migrationsReady } = useMigrations(db, migrations);

  // Initialize minimal stores needed for onboarding
  useSubscription(
    () => {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
