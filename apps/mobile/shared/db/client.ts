import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const DB_NAME = "fidy.db";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const sqlite = openDatabaseSync(DB_NAME);
    db = drizzle(sqlite);
  }
  return db;
}

export function resetDb() {
  db = null;
}
