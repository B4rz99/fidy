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
import { useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  runAuthenticatedBootstrap,
  runAuthenticatedMaintenanceBootstrap,
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
import { useSettingsStore } from "@/features/settings/hooks.public";
import { AppToastHost, ErrorFallback } from "@/shared/components";
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

const DIALOG_MODAL = {
  animation: "fade",
  contentStyle: { backgroundColor: "transparent" },
  headerShown: false,
  presentation: "transparentModal",
} as const;
const ONBOARDING_ALLOWED_ROUTES = new Set(["create-financial-account", "link-suggested-account"]);

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
  onboardingComplete,
}: {
  db: AnyDb;
  userId: UserId;
  enableRemoteEffects: boolean;
  onboardingComplete: boolean;
}) {
  const { push } = useRouter();
  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);

  useSubscription(
    () => {
      void runAuthenticatedMaintenanceBootstrap({ db, enableRemoteEffects, userId }).catch(
        captureError
      );
    },
    [db, enableRemoteEffects, userId],
    migrationsReady
  );

  useSubscription(
    () => {
      void runAuthenticatedBootstrap({ db, enableRemoteEffects, userId }).catch(captureError);
    },
    [db, enableRemoteEffects, onboardingComplete, userId],
    migrationsReady && onboardingComplete
  );

  useSubscription(
    () => subscribeAuthenticatedTransactionRefreshes({ db, enableRemoteEffects, userId }),
    [db, enableRemoteEffects, onboardingComplete, userId],
    migrationsReady && onboardingComplete
  );

  const captureDb = enableRemoteEffects && migrationsReady && onboardingComplete ? db : null;
  const captureUserId = enableRemoteEffects && onboardingComplete ? userId : null;
  const navigateToRoute = useCallback(
    (route: string) => {
      const href = route as unknown as Parameters<typeof push>[0];
      push(href);
    },
    [push]
  );
  useAuthenticatedCapturePipelines({ db: captureDb, userId: captureUserId });
  useAuthenticatedNotificationBootstrap({
    enableRemoteEffects: enableRemoteEffects && onboardingComplete,
    navigateToRoute,
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
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  const userId = useOptionalUserId();
  const onboardingComplete = useEffectiveOnboardingComplete();
  const { replace } = useRouter();
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
    void useSettingsStore.getState().hydrate();
  });

  // Side effects when session changes: set Sentry user
  useSubscription(() => {
    setSentryUser(userId);
  }, [userId]);

  useSubscription(
    () => {
      if (!userId) void SplashScreen.hideAsync();
    },
    [fontsLoaded, fontsError, isAuthLoading, settingsHydrated, userId],
    (fontsLoaded || fontsError != null) && !isAuthLoading && settingsHydrated
  );

  // Three-state routing: no user → login, user + not onboarded → onboarding, user + onboarded → tabs
  useSubscription(
    () => {
      const topSegment = segments[0] as string | undefined;
      const inAuthGroup = topSegment === "(auth)";
      const inOnboarding = (segments as string[])[1] === "onboarding";
      const inOnboardingAllowedRoute = topSegment
        ? ONBOARDING_ALLOWED_ROUTES.has(topSegment)
        : false;
      const inQaRoute =
        localQaAvailable &&
        (topSegment === "qa-tools" ||
          topSegment === "qa-transfer-conflict" ||
          topSegment === "qa-open");

      if (inQaRoute) {
        return;
      }

      if (!userId && !inAuthGroup) {
        replace("/(auth)");
      } else if (userId && !onboardingComplete && !inOnboarding && !inOnboardingAllowedRoute) {
        replace("/(auth)/onboarding");
      } else if (userId && onboardingComplete && inAuthGroup) {
        replace("/(tabs)/(index)");
      }
    },
    [localQaAvailable, onboardingComplete, replace, segments, userId],
    !isAuthLoading && settingsHydrated && (fontsLoaded || fontsError != null)
  );

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  if (isAuthLoading || !settingsHydrated) {
    return null;
  }

  const db = userId ? getDb(userId) : null;
  const iosHeaderOptions = {
    contentStyle: { backgroundColor: "transparent" },
    headerShadowVisible: false,
    headerShown: Platform.OS === "ios",
    headerStyle: { backgroundColor: "transparent" },
    headerTransparent: true,
    headerTintColor: theme.primary,
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SentryErrorBoundary fallback={ErrorFallback}>
        <QueryProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            {localQaAvailable ? <Stack.Screen name="qa-tools" options={iosHeaderOptions} /> : null}
            {localQaAvailable ? <Stack.Screen name="qa-open" options={iosHeaderOptions} /> : null}
            <Stack.Screen name="add-bill" options={DIALOG_MODAL} />
            <Stack.Screen name="day-detail" options={DIALOG_MODAL} />
            <Stack.Screen name="theme-picker" options={DIALOG_MODAL} />
            <Stack.Screen name="language-picker" options={DIALOG_MODAL} />
            <Stack.Screen name="delete-account" options={DIALOG_MODAL} />
            <Stack.Screen name="enable-notifications" options={DIALOG_MODAL} />
            <Stack.Screen name="analytics" options={iosHeaderOptions} />
            <Stack.Screen name="notifications" options={iosHeaderOptions} />
            <Stack.Screen name="search" options={iosHeaderOptions} />
            <Stack.Screen name="connected-accounts" options={iosHeaderOptions} />
            <Stack.Screen name="account-suggestions" options={iosHeaderOptions} />
            <Stack.Screen name="create-financial-account" options={iosHeaderOptions} />
            <Stack.Screen name="financial-accounts" options={iosHeaderOptions} />
            <Stack.Screen name="financial-account-details" options={iosHeaderOptions} />
            <Stack.Screen name="financial-account-form" options={iosHeaderOptions} />
            <Stack.Screen name="profile" options={iosHeaderOptions} />
            <Stack.Screen name="settings" options={iosHeaderOptions} />
            {__DEV__ ? <Stack.Screen name="design-system" options={iosHeaderOptions} /> : null}
            <Stack.Screen
              name="financial-account-identifier"
              options={{ ...DIALOG_MODAL, ...iosHeaderOptions }}
            />
            <Stack.Screen
              name="link-suggested-account"
              options={{ ...DIALOG_MODAL, ...iosHeaderOptions }}
            />
            <Stack.Screen name="create-budget" options={DIALOG_MODAL} />
            <Stack.Screen name="auto-suggest-budgets" options={DIALOG_MODAL} />
            <Stack.Screen name="goal-detail" options={iosHeaderOptions} />
            <Stack.Screen name="create-goal" options={DIALOG_MODAL} />
            <Stack.Screen name="add-payment" options={DIALOG_MODAL} />
            <Stack.Screen name="edit-goal" options={DIALOG_MODAL} />
            <Stack.Screen
              name="add-transaction"
              options={{
                ...DIALOG_MODAL,
                gestureEnabled: false,
                sheetGrabberVisible: false,
              }}
            />
            <Stack.Screen name="add-transfer" options={{ headerShown: false }} />
            <Stack.Screen name="bills-calendar" options={iosHeaderOptions} />
            <Stack.Screen name="ai-memories" options={iosHeaderOptions} />
            <Stack.Screen name="notification-preferences" options={iosHeaderOptions} />
            <Stack.Screen name="categories" options={iosHeaderOptions} />
            <Stack.Screen name="create-category" options={DIALOG_MODAL} />
            <Stack.Screen
              name="edit-transaction"
              options={{
                ...DIALOG_MODAL,
                gestureEnabled: false,
                sheetGrabberVisible: false,
              }}
            />
            <Stack.Screen name="reclassify-transaction" options={DIALOG_MODAL} />
            {localQaAvailable ? (
              <Stack.Screen name="qa-transfer-conflict" options={{ headerShown: false }} />
            ) : null}
          </Stack>
          {db && userId && (
            <AuthenticatedShell
              db={db}
              userId={userId}
              enableRemoteEffects={authMode === "remote"}
              onboardingComplete={onboardingComplete}
            />
          )}
        </QueryProvider>
      </SentryErrorBoundary>
      <AppToastHost />
      <QaStatusBanner />
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

export default wrapWithSentry(RootLayout);
