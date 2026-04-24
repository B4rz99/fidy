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
import { type Href, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  runAuthenticatedBootstrap,
  subscribeAuthenticatedTransactionRefreshes,
  useAuthenticatedCapturePipelines,
  useAuthenticatedNotificationBootstrap,
} from "@/bootstrap/authenticated-shell";
import {
  useAuthMode,
  useAuthStore,
  useEffectiveOnboardingComplete,
  useOptionalUserId,
} from "@/features/auth/hooks.public";
import { isLocalQaAvailable, useQaDevtoolsRuntime } from "@/features/qa/hooks.public";
import { QaStatusBanner } from "@/features/qa/ui.public";
import { useSyncBootstrap } from "@/features/sync/hooks.public";
import { ErrorFallback } from "@/shared/components";
import { Platform, useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { type AnyDb, getDb } from "@/shared/db";
import { useMountEffect, useSubscription } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n";
import {
  captureError,
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

function AuthenticatedShell({
  db,
  userId,
  enableRemoteEffects,
}: {
  db: AnyDb;
  userId: UserId;
  enableRemoteEffects: boolean;
}) {
  const router = useRouter();
  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);

  useSubscription(
    () => {
      void runAuthenticatedBootstrap({ db, enableRemoteEffects, userId }).catch(captureError);
    },
    [db, enableRemoteEffects, userId],
    migrationsReady
  );

  useSubscription(
    () => subscribeAuthenticatedTransactionRefreshes({ db, enableRemoteEffects, userId }),
    [db, enableRemoteEffects, userId],
    migrationsReady
  );

  const initialSyncDone = useSyncBootstrap({ db, enableRemoteEffects, migrationsReady, userId });
  const captureDb = enableRemoteEffects && initialSyncDone && migrationsReady ? db : null;
  const captureUserId = enableRemoteEffects ? userId : null;
  useAuthenticatedCapturePipelines({ db: captureDb, userId: captureUserId });
  useAuthenticatedNotificationBootstrap({
    enableRemoteEffects,
    navigateToRoute: (route) => {
      router.push(route as Href);
    },
    userId,
  });

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
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const authMode = useAuthMode();
  const userId = useOptionalUserId();
  const onboardingComplete = useEffectiveOnboardingComplete();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];
  const localQaAvailable = isLocalQaAvailable();

  useQaDevtoolsRuntime();

  const [fontsLoaded, fontsError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useMountEffect(() => {
    void useAuthStore.getState().restoreSession();
  });

  // Side effects when session changes: set Sentry user
  useSubscription(() => {
    setSentryUser(userId);
  }, [userId]);

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
      const topSegment = segments[0] as string | undefined;
      const inAuthGroup = topSegment === "(auth)";
      const inOnboarding = (segments as string[])[1] === "onboarding";
      const inQaRoute =
        localQaAvailable &&
        (topSegment === "qa-tools" ||
          topSegment === "qa-transfer-conflict" ||
          topSegment === "qa-open");

      if (inQaRoute) {
        return;
      }

      if (!userId && !inAuthGroup) {
        router.replace("/(auth)");
      } else if (userId && !onboardingComplete && !inOnboarding) {
        router.replace("/(auth)/onboarding");
      } else if (userId && onboardingComplete && inAuthGroup) {
        router.replace("/(tabs)/(index)" as never);
      }
    },
    [localQaAvailable, onboardingComplete, router, segments, userId],
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
            {localQaAvailable ? (
              <Stack.Screen
                name="qa-tools"
                options={{
                  headerShown: Platform.OS === "ios",
                  headerStyle: { backgroundColor: theme.page },
                  headerTintColor: theme.primary,
                }}
              />
            ) : null}
            {localQaAvailable ? (
              <Stack.Screen
                name="qa-open"
                options={{
                  headerShown: Platform.OS === "ios",
                  headerStyle: { backgroundColor: theme.page },
                  headerTintColor: theme.primary,
                }}
              />
            ) : null}
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
              name="account-suggestions"
              options={{
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
              }}
            />
            <Stack.Screen
              name="create-financial-account"
              options={{
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
              }}
            />
            <Stack.Screen
              name="financial-accounts"
              options={{
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
              }}
            />
            <Stack.Screen
              name="financial-account-details"
              options={{
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
              }}
            />
            <Stack.Screen
              name="financial-account-form"
              options={{
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
              }}
            />
            <Stack.Screen
              name="financial-account-identifier"
              options={{
                ...SHEET,
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
                sheetAllowedDetents: [0.62],
              }}
            />
            <Stack.Screen
              name="link-suggested-account"
              options={{
                ...SHEET,
                headerShown: Platform.OS === "ios",
                headerStyle: { backgroundColor: theme.page },
                headerTintColor: theme.primary,
                sheetAllowedDetents: [0.8],
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
              name="add-transaction"
              options={{
                ...SHEET,
                sheetAllowedDetents: [0.65],
                gestureEnabled: false,
                sheetGrabberVisible: false,
              }}
            />
            <Stack.Screen
              name="add-transfer"
              options={{
                headerShown: false,
              }}
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
            {localQaAvailable ? (
              <Stack.Screen
                name="qa-transfer-conflict"
                options={{
                  headerShown: false,
                }}
              />
            ) : null}
          </Stack>
          {db && userId && onboardingComplete && (
            <AuthenticatedShell
              db={db}
              userId={userId}
              enableRemoteEffects={authMode === "remote"}
            />
          )}
        </QueryProvider>
      </SentryErrorBoundary>
      <QaStatusBanner />
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

export default wrapWithSentry(RootLayout);
