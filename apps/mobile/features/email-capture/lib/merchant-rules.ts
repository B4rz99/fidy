import { and, eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { merchantRules } from "@/shared/db";
import { generateMerchantRuleId } from "@/shared/lib";
import type { CategoryId, IsoDateTime, UserId } from "@/shared/types/branded";

export async function lookupMerchantRule(
  db: AnyDb,
  userId: UserId,
  keyword: string
): Promise<CategoryId | null> {
  const rows = await db
    .select({ categoryId: merchantRules.categoryId })
    .from(merchantRules)
    .where(and(eq(merchantRules.userId, userId), eq(merchantRules.keyword, keyword)));
  return rows[0]?.categoryId ?? null;
}

export async function insertMerchantRule(
  db: AnyDb,
  userId: UserId,
  keyword: string,
  categoryId: CategoryId,
  now: IsoDateTime
): Promise<void> {
  await db
    .insert(merchantRules)
    .values({
      id: generateMerchantRuleId(),
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
