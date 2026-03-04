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
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTransactionStore } from "@/features/transactions/store";
import { getDb } from "@/shared/db/client";
import migrations from "../drizzle/migrations";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const db = getDb();
  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);

  const [fontsLoaded, fontsError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (migrationsReady) {
      useTransactionStore.getState().initStore(db);
      useTransactionStore.getState().loadTransactions();
    }
  }, [migrationsReady, db]);

  useEffect(() => {
    if ((fontsLoaded || fontsError) && (migrationsReady || migrationsError)) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError, migrationsReady, migrationsError]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  if (!migrationsReady && !migrationsError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
