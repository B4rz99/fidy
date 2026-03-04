import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

// biome-ignore lint/suspicious/noExplicitAny: drizzle generic varies by caller
export type AnyDb = ExpoSQLiteDatabase<any>;

const DB_NAME = "fidy.db";
// TODO: move to secure storage when auth is added
const DB_KEY = "fidy-dev-key-2026";

let db: ReturnType<typeof drizzle> | null = null;
let sqliteRef: ReturnType<typeof openDatabaseSync> | null = null;

export function getDb() {
  if (!db) {
    sqliteRef = openDatabaseSync(DB_NAME);
    sqliteRef.execSync(`PRAGMA key = '${DB_KEY}'`);
    db = drizzle(sqliteRef);
  }
  return db;
}

export function resetDb() {
  try {
    sqliteRef?.closeSync();
  } finally {
    sqliteRef = null;
    db = null;
  }
}
