import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { openDatabaseSync } from "expo-sqlite";
import { captureError } from "@/shared/lib/sentry";

// biome-ignore lint/suspicious/noExplicitAny: drizzle generic varies by caller
export type AnyDb = ExpoSQLiteDatabase<any>;

const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/;

function getOrCreateEncryptionKey(userId: string): string {
  const storeKey = `fidy-db-key-${userId}`;
  const existing = SecureStore.getItem(storeKey);
  if (existing && HEX_KEY_PATTERN.test(existing)) return existing;

  const randomBytes = Crypto.getRandomBytes(32);
  const hexKey = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  SecureStore.setItem(storeKey, hexKey);
  return hexKey;
}

let db: ReturnType<typeof drizzle> | null = null;
let sqliteRef: ReturnType<typeof openDatabaseSync> | null = null;
let currentUserId: string | null = null;

export function getDb(userId: string) {
  if (db && currentUserId !== userId) {
    resetDb();
  }
  if (!db) {
    try {
      const dbName = `fidy-${userId}.db`;
      const encryptionKey = getOrCreateEncryptionKey(userId);
      sqliteRef = openDatabaseSync(dbName);
      sqliteRef.execSync(`PRAGMA key = "x'${encryptionKey}'"`);
      db = drizzle(sqliteRef);
      currentUserId = userId;
    } catch (error) {
      resetDb();
      captureError(error);
      throw error;
    }
  }
  return db;
}

export function resetDb() {
  try {
    sqliteRef?.closeSync();
  } finally {
    sqliteRef = null;
    db = null;
    currentUserId = null;
  }
}
