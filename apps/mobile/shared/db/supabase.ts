import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
const supabaseAuthOptions = {
  storage: secureStoreAdapter,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
};

let client: SupabaseClient | null = null;

type SupabaseConfig = {
  readonly url: string;
  readonly anonKey: string;
};

function readOptionalEnv(
  name: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY"
): string {
  const value = process.env[name];
  return typeof value === "string" ? value : "";
}

function readSupabaseConfig(): SupabaseConfig {
  const url = readOptionalEnv("EXPO_PUBLIC_SUPABASE_URL");
  if (url.length === 0) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  const anonKey = readOptionalEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  if (anonKey.length === 0) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}

export function resetSupabase() {
  client = null;
}

export function getSupabase(): SupabaseClient {
  if (client) {
    return client;
  }

  const { url, anonKey } = readSupabaseConfig();
  client = createClient(url, anonKey, { auth: supabaseAuthOptions });
  return client;
}
