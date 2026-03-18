import { count } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { syncQueue } from "@/shared/db/schema";

export const getUnsyncedCount = (db: AnyDb): number => {
  const row = db.select({ total: count() }).from(syncQueue).get();
  return row?.total ?? 0;
};
