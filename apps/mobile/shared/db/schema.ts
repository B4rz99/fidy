import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type {
  AccountId,
  BillId,
  BillPaymentId,
  BudgetId,
  CategoryId,
  ChatMessageId,
  ChatSessionId,
  CopAmount,
  DetectedSmsEventId,
  EmailAccountId,
  IsoDate,
  IsoDateTime,
  MerchantRuleId,
  Month,
  NotificationId,
  NotificationSourceId,
  ProcessedCaptureId,
  ProcessedEmailId,
  SyncConflictId,
  SyncQueueId,
  TransactionId,
  UserCategoryId,
  UserId,
  UserMemoryId,
} from "@/shared/types/branded";

export const bills = sqliteTable(
  "bills",
  {
    id: text("id").$type<BillId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    name: text("name").notNull(),
    amount: integer("amount").$type<CopAmount>().notNull(),
    frequency: text("frequency").notNull(),
    categoryId: text("category_id").$type<CategoryId>().notNull(),
    startDate: text("start_date").$type<IsoDate>().notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [
    index("idx_bills_user").on(table.userId),
    index("idx_bills_user_active").on(table.userId, table.isActive),
  ]
);

export const billPayments = sqliteTable(
  "bill_payments",
  {
    id: text("id").$type<BillPaymentId>().primaryKey(),
    billId: text("bill_id").$type<BillId>().notNull(),
    dueDate: text("due_date").$type<IsoDate>().notNull(),
    paidAt: text("paid_at").$type<IsoDateTime>().notNull(),
    transactionId: text("transaction_id").$type<TransactionId>(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [
    index("idx_bill_payments_bill").on(table.billId),
    uniqueIndex("uq_bill_payment_occurrence").on(table.billId, table.dueDate),
  ]
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").$type<TransactionId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    type: text("type").notNull(),
    amount: integer("amount").$type<CopAmount>().notNull(),
    categoryId: text("category_id").$type<CategoryId>().notNull(),
    description: text("description"),
    date: text("date").$type<IsoDate>().notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
    source: text("source").notNull().default("manual"),
    accountId: text("account_id")
      .$type<AccountId>()
      .notNull()
      .default("" as AccountId),
    linkedTransactionId: text("linked_transaction_id").$type<TransactionId>(),
    needsAccountReview: integer("needs_account_review").notNull().default(0),
  },
  (table) => [
    index("idx_transactions_user_date").on(table.userId, table.date),
    index("idx_transactions_user_category").on(table.userId, table.categoryId),
    index("idx_transactions_account").on(table.accountId),
  ]
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").$type<AccountId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    bankKey: text("bank_key").notNull(),
    identifiers: text("identifiers").notNull().default("[]"),
    initialBalance: integer("initial_balance")
      .$type<CopAmount>()
      .notNull()
      .default(0 as CopAmount),
    isDefault: integer("is_default").notNull().default(0),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_accounts_user").on(table.userId),
    index("idx_accounts_user_bank").on(table.userId, table.bankKey),
  ]
);

export const emailAccounts = sqliteTable(
  "email_accounts",
  {
    id: text("id").$type<EmailAccountId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    provider: text("provider").notNull(),
    email: text("email").notNull(),
    lastFetchedAt: text("last_fetched_at").$type<IsoDateTime>(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [index("idx_email_accounts_user").on(table.userId)]
);

export const processedEmails = sqliteTable(
  "processed_emails",
  {
    id: text("id").$type<ProcessedEmailId>().primaryKey(),
    externalId: text("external_id").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    subject: text("subject").notNull(),
    rawBodyPreview: text("raw_body_preview"),
    receivedAt: text("received_at").$type<IsoDateTime>().notNull(),
    transactionId: text("transaction_id").$type<TransactionId>(),
    confidence: real("confidence"),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    rawBody: text("raw_body"),
    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: text("next_retry_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_processed_external_id").on(table.externalId),
    index("idx_processed_status").on(table.status),
  ]
);

export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").$type<SyncQueueId>().primaryKey(),
  tableName: text("table_name").notNull(),
  rowId: text("row_id").notNull(),
  operation: text("operation").notNull(),
  createdAt: text("created_at").$type<IsoDateTime>().notNull(),
});

export const syncMeta = sqliteTable("sync_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const syncConflicts = sqliteTable(
  "sync_conflicts",
  {
    id: text("id").$type<SyncConflictId>().primaryKey(),
    transactionId: text("transaction_id").$type<TransactionId>().notNull(),
    localData: text("local_data").notNull(),
    serverData: text("server_data").notNull(),
    detectedAt: text("detected_at").$type<IsoDateTime>().notNull(),
    resolvedAt: text("resolved_at").$type<IsoDateTime>(),
    resolution: text("resolution"),
  },
  (table) => [index("idx_sync_conflicts_resolved").on(table.resolvedAt)]
);

export const merchantRules = sqliteTable(
  "merchant_rules",
  {
    id: text("id").$type<MerchantRuleId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    keyword: text("keyword").notNull(),
    categoryId: text("category_id").$type<CategoryId>().notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [
    uniqueIndex("uq_merchant_rule_v2").on(table.userId, table.keyword),
    index("idx_merchant_lookup_v2").on(table.userId),
  ]
);

export const notificationSources = sqliteTable(
  "notification_sources",
  {
    id: text("id").$type<NotificationSourceId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    packageName: text("package_name").notNull(),
    label: text("label").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [uniqueIndex("uq_notification_source").on(table.userId, table.packageName)]
);

export const processedCaptures = sqliteTable(
  "processed_captures",
  {
    id: text("id").$type<ProcessedCaptureId>().primaryKey(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    rawText: text("raw_text"),
    transactionId: text("transaction_id").$type<TransactionId>(),
    confidence: real("confidence"),
    receivedAt: text("received_at").$type<IsoDateTime>().notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [
    uniqueIndex("uq_capture_fingerprint").on(table.fingerprintHash),
    index("idx_capture_source").on(table.source),
  ]
);

export const detectedSmsEvents = sqliteTable(
  "detected_sms_events",
  {
    id: text("id").$type<DetectedSmsEventId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    senderLabel: text("sender_label").notNull(),
    detectedAt: text("detected_at").$type<IsoDateTime>().notNull(),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    linkedTransactionId: text("linked_transaction_id").$type<TransactionId>(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [index("idx_sms_events_user_dismissed").on(table.userId, table.dismissed)]
);

export const chatSessions = sqliteTable(
  "chat_sessions",
  {
    id: text("id").$type<ChatSessionId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    title: text("title").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    expiresAt: text("expires_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_chat_sessions_user_created").on(table.userId, table.createdAt),
    index("idx_chat_sessions_expires").on(table.expiresAt),
  ]
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").$type<ChatMessageId>().primaryKey(),
    sessionId: text("session_id").$type<ChatSessionId>().notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    action: text("action"),
    actionStatus: text("action_status"),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [index("idx_chat_messages_session_created").on(table.sessionId, table.createdAt)]
);

export const userMemories = sqliteTable(
  "user_memories",
  {
    id: text("id").$type<UserMemoryId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    fact: text("fact").notNull(),
    category: text("category").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
  },
  (table) => [index("idx_user_memories_user").on(table.userId)]
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").$type<BudgetId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    categoryId: text("category_id").$type<CategoryId>().notNull(),
    amount: integer("amount").$type<CopAmount>().notNull(),
    month: text("month").$type<Month>().notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_budget_user_category_month").on(table.userId, table.categoryId, table.month),
    index("idx_budgets_user_month").on(table.userId, table.month),
  ]
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    targetAmount: integer("target_amount").notNull(),
    targetDate: text("target_date"),
    interestRatePercent: real("interest_rate_percent"),
    iconName: text("icon_name"),
    colorHex: text("color_hex"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [index("idx_goals_user").on(table.userId)]
);

export const goalContributions = sqliteTable(
  "goal_contributions",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id").notNull(),
    userId: text("user_id").notNull(),
    amount: integer("amount").notNull(),
    note: text("note"),
    date: text("date").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_goal_contributions_goal").on(table.goalId),
    index("idx_goal_contributions_goal_date").on(table.goalId, table.date),
    index("idx_goal_contributions_user").on(table.userId),
  ]
);

export const userCategories = sqliteTable(
  "user_categories",
  {
    id: text("id").$type<UserCategoryId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    name: text("name").notNull(),
    iconName: text("icon_name").notNull(),
    colorHex: text("color_hex").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [index("idx_user_categories_user").on(table.userId)]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").$type<NotificationId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    type: text("type").notNull(),
    dedupKey: text("dedup_key").notNull(),
    categoryId: text("category_id").$type<CategoryId>(),
    goalId: text("goal_id"),
    titleKey: text("title_key").notNull(),
    messageKey: text("message_key").notNull(),
    params: text("params"),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_notifications_user_created").on(table.userId, table.createdAt),
    uniqueIndex("uq_notification_dedup").on(table.userId, table.dedupKey),
  ]
);
