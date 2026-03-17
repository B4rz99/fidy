import { and, eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { merchantRules } from "@/shared/db";
import { generateId } from "@/shared/lib";

export async function lookupMerchantRule(
  db: AnyDb,
  userId: string,
  keyword: string
): Promise<string | null> {
  const rows = await db
    .select({ categoryId: merchantRules.categoryId })
    .from(merchantRules)
    .where(and(eq(merchantRules.userId, userId), eq(merchantRules.keyword, keyword)));
  return rows[0]?.categoryId ?? null;
}

export async function insertMerchantRule(
  db: AnyDb,
  userId: string,
  keyword: string,
  categoryId: string,
  now: string
): Promise<void> {
  await db
    .insert(merchantRules)
    .values({
      id: generateId("mr"),
      userId,
      keyword,
      categoryId,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [merchantRules.userId, merchantRules.keyword],
      set: { categoryId, createdAt: now },
    });
}
