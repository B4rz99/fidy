import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const DB_NAME = "fidy.db";
// TODO: move to secure storage when auth is added
const DB_KEY = "fidy-dev-key-2026";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const sqlite = openDatabaseSync(DB_NAME);
    sqlite.execSync(`PRAGMA key = '${DB_KEY}'`);
    db = drizzle(sqlite);
  }
  return db;
}

export function resetDb() {
  db = null;
}
