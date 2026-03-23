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
import * as Notifications from "expo-notifications";
import { type Href, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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
import { useCategoriesStore } from "@/features/categories";
import { useEmailCapture, useEmailCaptureStore } from "@/features/email-capture";
import { useGoalStore } from "@/features/goals";
import { useNotificationStore } from "@/features/notifications";
import { registerPushToken } from "@/features/notifications/services/push-token";
import {
  clearOnboardingFromStore,
  getOnboardingCompleteFromStore,
  isOnboardingComplete,
} from "@/features/onboarding";
import { useSearchStore } from "@/features/search";
import { useSettingsStore } from "@/features/settings";
import { useSync, useSyncConflictStore } from "@/features/sync";
import { useTransactionStore } from "@/features/transactions";
import { ErrorFallback } from "@/shared/components";
import { Platform, useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { type AnyDb, getDb } from "@/shared/db";
import { useMountEffect } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n";
import {
  captureError,
  handleRecoverableError,
  initSentry,
  SentryErrorBoundary,
  setSentryUser,
  wrapWithSentry,
} from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import migrations from "../drizzle/migrations";

const SHEET = { headerShown: false, presentation: "formSheet" } as const;

// Init locale synchronously before first render
useLocaleStore.getState().initLocale(getLocales()[0]?.languageTag ?? "es");

SplashScreen.preventAutoHideAsync();

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
if (SENTRY_DSN) {
  initSentry(SENTRY_DSN);
}

function AuthenticatedShell({ db, userId }: { db: AnyDb; userId: UserId }) {
  const router = useRouter();
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
      useGoalStore.getState().initStore(db, userId);
      useCategoriesStore.getState().initStore(db, userId);
      useNotificationStore.getState().initStore(db, userId);
      useSyncConflictStore.getState().initStore(db);
      Promise.all([
        useCalendarStore.getState().loadBills(),
        useCalendarStore.getState().loadPaymentsForMonth(),
      ]).catch(handleRecoverableError("Failed to load calendar data"));
      useBudgetStore
        .getState()
        .loadBudgets()
        .catch(handleRecoverableError("Failed to load budgets"));
      useGoalStore.getState().loadGoals().catch(handleRecoverableError("Failed to load goals"));
      useCategoriesStore
        .getState()
        .loadUserCategories()
        .catch(handleRecoverableError("Failed to load user categories"));
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
  const captureDb = initialSyncDone && migrationsReady ? db : null;
  useEmailCapture(captureDb, userId);
  useNotificationCapture(captureDb, userId);
  useApplePayCapture(captureDb, userId);
  useSmsDetection(captureDb, userId);

  // Global notification handler + push token / response listeners
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    registerPushToken(userId).catch(captureError);

    const tokenSub = Notifications.addPushTokenListener(() => {
      registerPushToken(userId).catch(captureError);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const route = data?.route;
      if (typeof route === "string" && route.startsWith("/")) {
        router.push(route as Href);
      }
    });

    return () => {
      tokenSub.remove();
      responseSub.remove();
    };
  }, [userId, router]);

  useEffect(() => {
    if (migrationsError) {
      captureError(migrationsError);
    }
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
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];

  // Onboarding completion: check SecureStore first, then session metadata
  const [onboardingComplete, setOnboardingComplete] = useState(() =>
    getOnboardingCompleteFromStore()
  );

  const [fontsLoaded, fontsError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useMountEffect(() => {
    useAuthStore.getState().restoreSession();
  });

  // Re-check onboarding status when session changes
  useEffect(() => {
    setSentryUser(userId);
    if (session) {
      const fromStore = getOnboardingCompleteFromStore();
      const fromSession = isOnboardingComplete(session);
      setOnboardingComplete(fromStore || fromSession);
    } else {
      // User signed out — clear local onboarding flag so a new user gets onboarding
      clearOnboardingFromStore();
      setOnboardingComplete(false);
    }
  }, [session, userId]);

  useEffect(() => {
    if ((fontsLoaded || fontsError) && !isAuthLoading) {
      if (!userId) {
        SplashScreen.hideAsync();
      }
    }
  }, [fontsLoaded, fontsError, isAuthLoading, userId]);

  // Three-state routing: no user → login, user + not onboarded → onboarding, user + onboarded → tabs
  useEffect(() => {
    if (isAuthLoading || (!fontsLoaded && !fontsError)) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = (segments as string[])[1] === "onboarding";

    if (!userId && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (userId && !onboardingComplete && !inOnboarding) {
      router.replace("/(auth)/onboarding");
    } else if (userId && onboardingComplete && inAuthGroup) {
      router.replace("/(tabs)" as never);
    }
  }, [userId, segments, isAuthLoading, fontsLoaded, fontsError, router, onboardingComplete]);

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
            name="add-bill"
            options={{ ...SHEET, sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="day-detail"
            options={{ ...SHEET, sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen name="theme-picker" options={{ ...SHEET, sheetAllowedDetents: [0.24] }} />
          <Stack.Screen
            name="language-picker"
            options={{ ...SHEET, sheetAllowedDetents: [0.18] }}
          />
          <Stack.Screen
            name="delete-account"
            options={{ ...SHEET, sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="enable-notifications"
            options={{ ...SHEET, sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="connected-accounts"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="failed-emails"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="create-budget"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="auto-suggest-budgets"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="goal-detail"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="create-goal"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="add-payment"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="edit-goal"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
          <Stack.Screen
            name="bills-calendar"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="ai-memories"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="notification-preferences"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="categories"
            options={{
              headerShown: Platform.OS === "ios",
              headerStyle: { backgroundColor: theme.page },
              headerTintColor: theme.primary,
            }}
          />
          <Stack.Screen
            name="create-category"
            options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
          />
        </Stack>
        {db && userId && onboardingComplete && (
          <AuthenticatedShell db={db} userId={userId as UserId} />
        )}
      </SentryErrorBoundary>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

export default wrapWithSentry(RootLayout);
