import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const bills = sqliteTable(
  "bills",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    frequency: text("frequency").notNull(),
    categoryId: text("category_id").notNull(),
    startDate: text("start_date").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_bills_user").on(table.userId),
    index("idx_bills_user_active").on(table.userId, table.isActive),
  ]
);

export const billPayments = sqliteTable(
  "bill_payments",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id").notNull(),
    dueDate: text("due_date").notNull(),
    paidAt: text("paid_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_bill_payments_bill").on(table.billId),
    uniqueIndex("uq_bill_payment_occurrence").on(table.billId, table.dueDate),
  ]
);

export const transactions = sqliteTable(
  "transactions",
  {
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
  },
  (table) => [
    index("idx_transactions_user_date").on(table.userId, table.date),
    index("idx_transactions_user_category").on(table.userId, table.categoryId),
  ]
);

export const emailAccounts = sqliteTable(
  "email_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    email: text("email").notNull(),
    lastFetchedAt: text("last_fetched_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_email_accounts_user").on(table.userId)]
);

export const processedEmails = sqliteTable(
  "processed_emails",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    subject: text("subject").notNull(),
    rawBodyPreview: text("raw_body_preview"),
    receivedAt: text("received_at").notNull(),
    transactionId: text("transaction_id"),
    confidence: real("confidence"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_processed_external_id").on(table.externalId),
    index("idx_processed_status").on(table.status),
  ]
);

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

export const merchantRules = sqliteTable(
  "merchant_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    senderEmail: text("sender_email").notNull(),
    keyword: text("keyword").notNull(),
    categoryId: text("category_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_merchant_rule").on(table.userId, table.senderEmail, table.keyword),
    index("idx_merchant_lookup").on(table.userId, table.senderEmail),
  ]
);

export const notificationSources = sqliteTable(
  "notification_sources",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    packageName: text("package_name").notNull(),
    label: text("label").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("uq_notification_source").on(table.userId, table.packageName)]
);

export const processedCaptures = sqliteTable(
  "processed_captures",
  {
    id: text("id").primaryKey(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    rawText: text("raw_text"),
    transactionId: text("transaction_id"),
    confidence: real("confidence"),
    receivedAt: text("received_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_capture_fingerprint").on(table.fingerprintHash),
    index("idx_capture_source").on(table.source),
  ]
);

export const detectedSmsEvents = sqliteTable(
  "detected_sms_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    senderLabel: text("sender_label").notNull(),
    detectedAt: text("detected_at").notNull(),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    linkedTransactionId: text("linked_transaction_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_sms_events_user_dismissed").on(table.userId, table.dismissed)]
);

export const chatSessions = sqliteTable(
  "chat_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_chat_sessions_user_created").on(table.userId, table.createdAt),
    index("idx_chat_sessions_expires").on(table.expiresAt),
  ]
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    action: text("action"),
    actionStatus: text("action_status"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_chat_messages_session_created").on(table.sessionId, table.createdAt)]
);

export const userMemories = sqliteTable(
  "user_memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fact: text("fact").notNull(),
    category: text("category").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_user_memories_user").on(table.userId)]
);
