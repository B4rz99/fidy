import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  categoryId: text("category_id").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull(),
  rowId: text("row_id").notNull(),
  operation: text("operation").notNull(),
  createdAt: text("created_at").notNull(),
});

export const syncMeta = sqliteTable("sync_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
