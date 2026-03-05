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
  source: text("source").notNull().default("manual"),
});

export const emailAccounts = sqliteTable("email_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  email: text("email").notNull(),
  lastFetchedAt: text("last_fetched_at"),
  createdAt: text("created_at").notNull(),
});

export const processedEmails = sqliteTable("processed_emails", {
  id: text("id").primaryKey(),
  externalId: text("external_id").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  failureReason: text("failure_reason"),
  subject: text("subject").notNull(),
  rawBodyPreview: text("raw_body_preview"),
  receivedAt: text("received_at").notNull(),
  transactionId: text("transaction_id"),
  createdAt: text("created_at").notNull(),
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
