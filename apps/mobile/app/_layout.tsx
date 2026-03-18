// biome-ignore-all lint/style/useNamingConvention: font export names from @expo-google-fonts
import "../global.css";
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from "@expo-google-fonts/poppins";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useFonts } from "expo-font";
import { getLocales } from "expo-localization";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useChatStore } from "@/features/ai-chat";
import { useAuthStore } from "@/features/auth";
import { registerBackgroundTask } from "@/features/background-fetch";
import { useBudgetStore } from "@/features/budget";
import { useCalendarStore } from "@/features/calendar";
import {
  useApplePayCapture,
  useCaptureSourcesStore,
  useNotificationCapture,
  useSmsDetection,
} from "@/features/capture-sources";
import { useEmailCapture, useEmailCaptureStore } from "@/features/email-capture";
import { useSearchStore } from "@/features/search";
import { useSettingsStore } from "@/features/settings";
import { useSync, useSyncConflictStore } from "@/features/sync";
import { useTransactionStore } from "@/features/transactions";
import { ErrorFallback } from "@/shared/components";
import { type AnyDb, getDb } from "@/shared/db";
import { useLocaleStore } from "@/shared/i18n";
import {
  captureError,
  handleRecoverableError,
  initSentry,
  SentryErrorBoundary,
  wrapWithSentry,
} from "@/shared/lib";
import migrations from "../drizzle/migrations";

// Init locale synchronously before first render
useLocaleStore.getState().initLocale(getLocales()[0]?.languageTag ?? "es");

SplashScreen.preventAutoHideAsync();

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
if (SENTRY_DSN) {
  initSentry(SENTRY_DSN);
}

function AuthenticatedShell({ db, userId }: { db: AnyDb; userId: string }) {
  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);

  useEffect(() => {
    if (migrationsReady) {
      useTransactionStore.getState().initStore(db, userId);
      useSearchStore.getState().initStore(db, userId);
      useEmailCaptureStore.getState().initStore(db, userId);
      useCaptureSourcesStore.getState().initStore(db, userId);
      useChatStore.getState().initStore(db, userId);
      useCalendarStore.getState().initStore(db, userId);
      useBudgetStore.getState().initStore(db, userId);
      useSyncConflictStore.getState().initStore(db);
      Promise.all([
        useCalendarStore.getState().loadBills(),
        useCalendarStore.getState().loadPaymentsForMonth(),
      ]).catch(handleRecoverableError("Failed to load calendar data"));
      useBudgetStore
        .getState()
        .loadBudgets()
        .catch(handleRecoverableError("Failed to load budgets"));
      useChatStore
        .getState()
        .loadSessions()
        .then(() => useChatStore.getState().cleanupExpiredSessions())
        .catch(handleRecoverableError("Failed to load chat sessions"));
      useCaptureSourcesStore
        .getState()
        .hydrate()
        .catch(handleRecoverableError("Failed to load capture sources"));
      useTransactionStore
        .getState()
        .loadInitialPage()
        .catch(handleRecoverableError("Failed to load transactions"));
      useSyncConflictStore.getState().loadConflicts();
      useSettingsStore
        .getState()
        .hydrate()
        .catch(handleRecoverableError("Failed to hydrate settings"));
      registerBackgroundTask().catch(captureError);
    }
  }, [migrationsReady, db, userId]);

  const initialSyncDone = useSync(migrationsReady ? db : null, userId);
  const captureDb = initialSyncDone ? db : null;
  useEmailCapture(captureDb, userId);
  useNotificationCapture(captureDb, userId);
  useApplePayCapture(captureDb, userId);
  useSmsDetection(captureDb, userId);

  useEffect(() => {
    if (migrationsReady || migrationsError) {
      SplashScreen.hideAsync();
    }
  }, [migrationsReady, migrationsError]);

  return null;
}

function RootLayout() {
  const session = useAuthStore((s) => s.session);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const userId = session?.user?.id ?? null;
  const router = useRouter();
  const segments = useSegments();

  const [fontsLoaded, fontsError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    useAuthStore.getState().restoreSession();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontsError) && !isAuthLoading) {
      if (!userId) {
        SplashScreen.hideAsync();
      }
    }
  }, [fontsLoaded, fontsError, isAuthLoading, userId]);

  useEffect(() => {
    if (isAuthLoading || (!fontsLoaded && !fontsError)) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (userId && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!userId && !inAuthGroup) {
      router.replace("/(auth)");
    }
  }, [userId, segments, isAuthLoading, fontsLoaded, fontsError, router]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  if (isAuthLoading) {
    return null;
  }

  const db = userId ? getDb(userId) : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SentryErrorBoundary fallback={ErrorFallback}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="add-transaction"
            options={{ presentation: "formSheet", sheetAllowedDetents: [0.53] }}
          />
          <Stack.Screen
            name="add-bill"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="day-detail"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="theme-picker"
            options={{ presentation: "formSheet", sheetAllowedDetents: [0.24] }}
          />
          <Stack.Screen
            name="language-picker"
            options={{ presentation: "formSheet", sheetAllowedDetents: [0.18] }}
          />
          <Stack.Screen
            name="delete-account"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="create-budget"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="auto-suggest-budgets"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen name="bills-calendar" />
          <Stack.Screen name="search" />
        </Stack>
        {db && userId && <AuthenticatedShell db={db} userId={userId} />}
      </SentryErrorBoundary>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

export default wrapWithSentry(RootLayout);
