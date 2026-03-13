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
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useChatStore } from "@/features/ai-chat/store";
import { useAuthStore } from "@/features/auth/store";
import { registerBackgroundTask } from "@/features/background-fetch/register";
import { useCalendarStore } from "@/features/calendar/store";
import { useApplePayCapture } from "@/features/capture-sources/hooks/useApplePayCapture";
import { useNotificationCapture } from "@/features/capture-sources/hooks/useNotificationCapture";
import { useSmsDetection } from "@/features/capture-sources/hooks/useSmsDetection";
import { useCaptureSourcesStore } from "@/features/capture-sources/store";
import { useEmailCapture } from "@/features/email-capture/hooks/useEmailCapture";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { useSync } from "@/features/sync/hooks/useSync";
import { useTransactionStore } from "@/features/transactions/store";
import type { AnyDb } from "@/shared/db/client";
import { getDb } from "@/shared/db/client";
import migrations from "../drizzle/migrations";

SplashScreen.preventAutoHideAsync();

function AuthenticatedShell({ db, userId }: { db: AnyDb; userId: string }) {
  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);

  useEffect(() => {
    if (migrationsReady) {
      useTransactionStore.getState().initStore(db, userId);
      useEmailCaptureStore.getState().initStore(db, userId);
      useCaptureSourcesStore.getState().initStore(db, userId);
      useChatStore.getState().initStore(db, userId);
      useCalendarStore.getState().initStore(db, userId);
      Promise.all([
        useCalendarStore.getState().loadBills(),
        useCalendarStore.getState().loadPaymentsForMonth(),
      ]).catch(() => {});
      useChatStore
        .getState()
        .loadSessions()
        .then(() => useChatStore.getState().cleanupExpiredSessions())
        .catch(() => {});
      useCaptureSourcesStore
        .getState()
        .hydrate()
        .catch(() => {});
      useTransactionStore
        .getState()
        .loadTransactions()
        .catch(() => {});
      registerBackgroundTask().catch(() => {});
    }
  }, [migrationsReady, db, userId]);

  useSync(migrationsReady ? db : null, userId);
  useEmailCapture(migrationsReady ? db : null, userId);
  useNotificationCapture(migrationsReady ? db : null, userId);
  useApplePayCapture(migrationsReady ? db : null, userId);
  useSmsDetection(migrationsReady ? db : null, userId);

  useEffect(() => {
    if (migrationsReady || migrationsError) {
      SplashScreen.hideAsync();
    }
  }, [migrationsReady, migrationsError]);

  return null;
}

export default function RootLayout() {
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-transaction" options={{ presentation: "formSheet" }} />
        <Stack.Screen
          name="add-bill"
          options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
        />
        <Stack.Screen
          name="day-detail"
          options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents" }}
        />
      </Stack>
      {db && userId && <AuthenticatedShell db={db} userId={userId} />}
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
