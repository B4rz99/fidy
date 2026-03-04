import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  categoryId: text("category_id").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
});
