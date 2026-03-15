import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { captureError } from "@/shared/lib/sentry";

// biome-ignore lint/suspicious/noExplicitAny: drizzle generic varies by caller
export type AnyDb = ExpoSQLiteDatabase<any>;

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
      const dbKey = `fidy-key-${userId}`;
      sqliteRef = openDatabaseSync(dbName);
      sqliteRef.execSync(`PRAGMA key = '${dbKey}'`);
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
