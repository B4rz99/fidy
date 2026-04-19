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
import { useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  cleanupExpiredChatSessions,
  initializeChatSession,
  loadChatSessions,
} from "@/features/ai-chat";
import {
  initializeAnalyticsSession,
  loadAnalyticsForUser,
  subscribeAnalyticsToTransactions,
  useAnalyticsStore,
} from "@/features/analytics";
import { useAuthStore, useOptionalUserId } from "@/features/auth";
import { registerBackgroundTask } from "@/features/background-fetch";
import {
  initializeBudgetSession,
  loadBudgetsForUser,
  subscribeBudgetToTransactions,
  useBudgetStore,
} from "@/features/budget";
import {
  initializeCalendarSession,
  loadBills as loadCalendarBills,
  loadPaymentsForMonth as loadCalendarPaymentsForMonth,
} from "@/features/calendar";
import {
  hydrateCaptureSources,
  useApplePayCapture,
  useNotificationCapture,
  useSmsDetection,
  useWidgetCapture,
} from "@/features/capture-sources";
import { refreshCategories } from "@/features/categories";
import {
  initializeEmailCaptureSession,
  loadEmailAccounts,
  useEmailCapture,
} from "@/features/email-capture";
import { tryEnsureDefaultFinancialAccount } from "@/features/financial-accounts";
import {
  initializeGoalSession,
  loadGoalsForUser,
  subscribeGoalsToTransactions,
  useGoalStore,
} from "@/features/goals";
import { initializeNotificationStore, registerPushToken } from "@/features/notifications";
import {
  clearOnboardingFromStore,
  getOnboardingCompleteFromStore,
  isOnboardingComplete,
} from "@/features/onboarding";
import { useSettingsStore } from "@/features/settings";
import { loadSyncConflicts, useSync } from "@/features/sync";
import {
  initializeTransactionSession,
  loadInitialTransactions,
  useTransactionStore,
} from "@/features/transactions";
import { ErrorFallback } from "@/shared/components";
import { Platform, useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { type AnyDb, getDb } from "@/shared/db";
import { useMountEffect, useSubscription } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n";
import {
  captureError,
  handleRecoverableError,
  initSentry,
  SentryErrorBoundary,
  setSentryUser,
  wrapWithSentry,
} from "@/shared/lib";
import { QueryProvider } from "@/shared/query";
import type { UserId } from "@/shared/types/branded";
import migrations from "../drizzle/migrations";

const SHEET = { headerShown: false, presentation: "formSheet" } as const;

// Init locale synchronously before first render
useLocaleStore.getState().initLocale(getLocales()[0]?.languageTag ?? "es"); // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- getLocales() CAN return empty array per Expo docs

void SplashScreen.preventAutoHideAsync();

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
if (SENTRY_DSN) {
  initSentry(SENTRY_DSN);
}

function AuthenticatedShell({ db, userId }: { db: AnyDb; userId: UserId }) {
  const router = useRouter();
  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);

  useSubscription(
    () => {
      void Promise.resolve()
        .then(() => {
          initializeTransactionSession(userId);
          const defaultAccount = tryEnsureDefaultFinancialAccount(db, userId);
          if (defaultAccount) {
            useTransactionStore.getState().setDefaultAccountId(defaultAccount.id);
          }
          initializeEmailCaptureSession(userId);
          initializeChatSession(userId);
          initializeCalendarSession(userId);
          initializeBudgetSession(userId);
          initializeGoalSession(userId);
          initializeAnalyticsSession(userId);
          void initializeNotificationStore(db, userId);
          Promise.all([loadCalendarBills(db, userId), loadCalendarPaymentsForMonth(db)]).catch(
            handleRecoverableError("Failed to load calendar data")
          );
          loadBudgetsForUser(db, userId).catch(handleRecoverableError("Failed to load budgets"));
          loadGoalsForUser(db, userId).catch(handleRecoverableError("Failed to load goals"));
          loadAnalyticsForUser(db, userId).catch(
            handleRecoverableError("Failed to load analytics")
          );
          loadEmailAccounts(db, userId).catch(
            handleRecoverableError("Failed to load email accounts")
          );
          refreshCategories(db, userId).catch(
            handleRecoverableError("Failed to load user categories")
          );
          loadChatSessions(db, userId)
            .then(() => cleanupExpiredChatSessions(db, userId))
            .catch(handleRecoverableError("Failed to load chat sessions"));
          hydrateCaptureSources(db, userId).catch(
            handleRecoverableError("Failed to load capture sources")
          );
          loadInitialTransactions(db, userId).catch(
            handleRecoverableError("Failed to load transactions")
          );
          void loadSyncConflicts(db);
          useSettingsStore
            .getState()
            .hydrate()
            .catch(handleRecoverableError("Failed to hydrate settings"));
          void registerBackgroundTask().catch(captureError);
        })
        .catch(captureError);
    },
    [db, userId],
    migrationsReady
  );

  useSubscription(
    () =>
      subscribeBudgetToTransactions({
        subscribeTransactions: useTransactionStore.subscribe,
        getTransactionDataRevision: () => useTransactionStore.getState().dataRevision,
        hasLoadedBudgetState: () => useBudgetStore.getState().hasLoadedOnce,
        reload: () => {
          void loadBudgetsForUser(db, userId).catch(
            handleRecoverableError("Failed to load budgets")
          );
        },
      }),
    [db, userId],
    migrationsReady
  );

  useSubscription(
    () =>
      subscribeGoalsToTransactions({
        subscribeTransactions: useTransactionStore.subscribe,
        getTransactionDataRevision: () => useTransactionStore.getState().dataRevision,
        hasLoadedGoals: () => useGoalStore.getState().goals.length > 0,
        reload: () => {
          void loadGoalsForUser(db, userId).catch(handleRecoverableError("Failed to load goals"));
        },
      }),
    [db, userId],
    migrationsReady
  );

  useSubscription(
    () =>
      subscribeAnalyticsToTransactions({
        subscribeTransactions: useTransactionStore.subscribe,
        getTransactionDataRevision: () => useTransactionStore.getState().dataRevision,
        hasLoadedAnalytics: () => useAnalyticsStore.getState().incomeExpense !== null,
        reload: () => {
          void loadAnalyticsForUser(db, userId).catch(
            handleRecoverableError("Failed to load analytics")
          );
        },
      }),
    [db, userId],
    migrationsReady
  );

  const initialSyncDone = useSync(migrationsReady ? db : null, userId);
  const captureDb = initialSyncDone && migrationsReady ? db : null;
  useEmailCapture(captureDb, userId);
  useNotificationCapture(captureDb, userId);
  useApplePayCapture(captureDb, userId);
  useSmsDetection(captureDb, userId);
  useWidgetCapture(captureDb, userId);

  // Global notification handler + push token / response listeners
  useSubscription(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    void registerPushToken(userId).catch(captureError);

    const tokenSub = Notifications.addPushTokenListener(() => {
      void registerPushToken(userId).catch(captureError);
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

  useSubscription(
    () => {
      if (migrationsError) captureError(migrationsError);
      void SplashScreen.hideAsync();
    },
    [migrationsReady, migrationsError],
    migrationsReady || migrationsError != null
  );

  return null;
}

function RootLayout() {
  const session = useAuthStore((s) => s.session);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const userId = useOptionalUserId();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];

  // Onboarding completion: check SecureStore first, then session metadata
  const onboardingComplete = useMemo(() => {
    if (session) {
      return getOnboardingCompleteFromStore() || isOnboardingComplete(session);
    }
    return false;
  }, [session]);

  const [fontsLoaded, fontsError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useMountEffect(() => {
    void useAuthStore.getState().restoreSession();
  });

  // Side effects when session changes: set Sentry user, clear onboarding on sign-out
  useSubscription(() => {
    setSentryUser(userId);
    if (!session) clearOnboardingFromStore();
  }, [session, userId]);

  useSubscription(
    () => {
      if (!userId) void SplashScreen.hideAsync();
    },
    [fontsLoaded, fontsError, isAuthLoading, userId],
    (fontsLoaded || fontsError != null) && !isAuthLoading
  );

  // Three-state routing: no user → login, user + not onboarded → onboarding, user + onboarded → tabs
  useSubscription(
    () => {
      const inAuthGroup = segments[0] === "(auth)";
      const inOnboarding = (segments as string[])[1] === "onboarding";

      if (!userId && !inAuthGroup) {
        router.replace("/(auth)");
      } else if (userId && !onboardingComplete && !inOnboarding) {
        router.replace("/(auth)/onboarding");
      } else if (userId && onboardingComplete && inAuthGroup) {
        router.replace("/(tabs)/(index)" as never);
      }
    },
    [userId, segments, router, onboardingComplete],
    !isAuthLoading && (fontsLoaded || fontsError != null)
  );

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
        <QueryProvider>
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
              name="analytics"
              options={{
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
              }}
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
            <Stack.Screen
              name="edit-transaction"
              options={{
                ...SHEET,
                sheetAllowedDetents: [0.65],
                gestureEnabled: false,
                sheetGrabberVisible: false,
              }}
            />
          </Stack>
          {db && userId && onboardingComplete && <AuthenticatedShell db={db} userId={userId} />}
        </QueryProvider>
      </SentryErrorBoundary>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

export default wrapWithSentry(RootLayout);
