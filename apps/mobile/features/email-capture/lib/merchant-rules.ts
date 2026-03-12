import { and, eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { merchantRules } from "@/shared/db/schema";
import { generateId } from "@/shared/lib/generate-id";

export async function lookupMerchantRule(
  db: AnyDb,
  userId: string,
  senderEmail: string,
  keyword: string
): Promise<string | null> {
  const rows = await db
    .select({ categoryId: merchantRules.categoryId })
    .from(merchantRules)
    .where(
      and(
        eq(merchantRules.userId, userId),
        eq(merchantRules.senderEmail, senderEmail),
        eq(merchantRules.keyword, keyword)
      )
    );
  return rows[0]?.categoryId ?? null;
}

export async function insertMerchantRule(
  db: AnyDb,
  userId: string,
  senderEmail: string,
  keyword: string,
  categoryId: string,
  now: string
): Promise<void> {
  await db
    .insert(merchantRules)
    .values({
      id: generateId("mr"),
      userId,
      senderEmail,
      keyword,
      categoryId,
      createdAt: now,
    })
    .onConflictDoNothing();
}
