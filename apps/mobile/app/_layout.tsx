// biome-ignore-all lint/style/useNamingConvention: font export names from @expo-google-fonts
import "../global.css";
import "@/shared/polyfills/array-to-sorted";
import {
  Poppins_300Light,
  Poppins_400Regular,
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
import { useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { type AnyDb, getDb } from "@/shared/db";
import { useMountEffect, useSubscription, useTranslation } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n";
import {
  captureError,
  initSentry,
  SentryErrorBoundary,
  setSentryUser,
  wrapWithSentry,
} from "@/shared/lib";
import {
  createRootStackRouteOptions,
  ROOT_STACK_ROUTES,
} from "@/shared/navigation/root-stack-routes";
import { QueryProvider } from "@/shared/query";
import type { UserId } from "@/shared/types/branded";
import migrations from "../drizzle/migrations";

const ONBOARDING_ALLOWED_ROUTES = new Set(["create-financial-account", "link-suggested-account"]);

// Init locale synchronously before first render
useLocaleStore.getState().initLocale(getLocales()[0]?.languageTag ?? "es"); // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- getLocales() CAN return empty array per Expo docs

void SplashScreen.preventAutoHideAsync();

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
if (SENTRY_DSN) {
  initSentry(SENTRY_DSN);
}

export function AuthenticatedShell({
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

export function RootLayout() {
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const authMode = useAuthMode();
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  const userId = useOptionalUserId();
  const onboardingComplete = useEffectiveOnboardingComplete();
  const { replace } = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];
  const { t } = useTranslation();
  const localQaAvailable = isLocalQaAvailable();

  useQaDevtoolsRuntime();

  const [fontsLoaded, fontsError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
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
  const routeOptions = createRootStackRouteOptions(theme, t);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SentryErrorBoundary fallback={ErrorFallback}>
        <QueryProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            {localQaAvailable
              ? ROOT_STACK_ROUTES.localQaTransparentHeader.map((name) => (
                  <Stack.Screen key={name} name={name} options={routeOptions.transparentHeader} />
                ))
              : null}
            {ROOT_STACK_ROUTES.fullScreen.map((name) => (
              <Stack.Screen key={name} name={name} options={routeOptions.fullScreen} />
            ))}
            <Stack.Screen name="create-goal" options={routeOptions.titled.createGoal} />
            {ROOT_STACK_ROUTES.dialog.map((name) => (
              <Stack.Screen key={name} name={name} options={routeOptions.dialog} />
            ))}
            {ROOT_STACK_ROUTES.transparentHeader.map((name) => (
              <Stack.Screen key={name} name={name} options={routeOptions.transparentHeader} />
            ))}
            {__DEV__
              ? ROOT_STACK_ROUTES.devOnlyTransparentHeader.map((name) => (
                  <Stack.Screen key={name} name={name} options={routeOptions.transparentHeader} />
                ))
              : null}
            {ROOT_STACK_ROUTES.screenLayout.map((name) => (
              <Stack.Screen key={name} name={name} options={routeOptions.screenLayout} />
            ))}
            <Stack.Screen name="create-budget" options={routeOptions.titled.createBudget} />
            <Stack.Screen
              name="auto-suggest-budgets"
              options={routeOptions.titled.autoSuggestBudgets}
            />
            {ROOT_STACK_ROUTES.entry.map((name) => (
              <Stack.Screen key={name} name={name} options={routeOptions.entry} />
            ))}
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

const SentryWrappedRootLayout = wrapWithSentry(RootLayout);

export default SentryWrappedRootLayout;
