import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { TransferSource } from "@/shared/types/ledger-source";
import type {
  AccountSuggestionDismissalId,
  BillId,
  BillPaymentId,
  BudgetId,
  CaptureEvidenceId,
  CategoryColorOverrideId,
  CategoryIconOverrideId,
  CategoryId,
  ChatMessageId,
  ChatSessionId,
  CopAmount,
  DetectedSmsEventId,
  EmailAccountId,
  EmailParseImprovementSampleId,
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDate,
  IsoDateTime,
  MerchantRuleId,
  Month,
  NotificationId,
  NotificationSourceId,
  OpeningBalanceId,
  ProcessedSourceEventId,
  ReviewCandidateCaptureEvidenceId,
  ReviewCandidateId,
  TransactionId,
  TransferId,
  UserCategoryId,
  UserId,
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
    counterpartyName: text("counterparty_name"),
    date: text("date").$type<IsoDate>().notNull(),
    accountId: text("account_id").$type<FinancialAccountId>().notNull(),
    accountAttributionState: text("account_attribution_state").notNull(),
    supersededAt: text("superseded_at").$type<IsoDateTime>(),
    supersededByTransferId: text("superseded_by_transfer_id").$type<TransferId>(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    voidedAt: text("voided_at").$type<IsoDateTime>(),
    source: text("source").notNull().default("manual"),
  },
  (table) => [
    index("idx_transactions_user_date").on(table.userId, table.date),
    index("idx_transactions_user_category").on(table.userId, table.categoryId),
  ]
);

export const financialAccounts = sqliteTable(
  "financial_accounts",
  {
    id: text("id").$type<FinancialAccountId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    statementClosingDay: integer("statement_closing_day"),
    paymentDueDay: integer("payment_due_day"),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_financial_accounts_user").on(table.userId),
    index("idx_financial_accounts_user_default").on(table.userId, table.isDefault),
  ]
);

export const transfers = sqliteTable(
  "transfers",
  {
    id: text("id").$type<TransferId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    amount: integer("amount").$type<CopAmount>().notNull(),
    fromAccountId: text("from_account_id").$type<FinancialAccountId>(),
    toAccountId: text("to_account_id").$type<FinancialAccountId>(),
    fromExternalLabel: text("from_external_label"),
    toExternalLabel: text("to_external_label"),
    description: text("description"),
    date: text("date").$type<IsoDate>().notNull(),
    source: text("source").$type<TransferSource>().notNull().default("manual"),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    voidedAt: text("voided_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_transfers_user_date").on(table.userId, table.date),
    index("idx_transfers_user_updated").on(table.userId, table.updatedAt),
    check(
      "ck_transfers_from_endpoint",
      sql`${table.fromAccountId} is not null or nullif(trim(${table.fromExternalLabel}), '') is not null`
    ),
    check(
      "ck_transfers_to_endpoint",
      sql`${table.toAccountId} is not null or nullif(trim(${table.toExternalLabel}), '') is not null`
    ),
  ]
);

export const openingBalances = sqliteTable(
  "opening_balances",
  {
    id: text("id").$type<OpeningBalanceId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    accountId: text("account_id").$type<FinancialAccountId>().notNull(),
    amount: integer("amount").$type<CopAmount>().notNull(),
    effectiveDate: text("effective_date").$type<IsoDate>().notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_opening_balances_account")
      .on(table.accountId)
      .where(sql`${table.deletedAt} is null`),
    index("idx_opening_balances_user").on(table.userId),
  ]
);

export const financialAccountIdentifiers = sqliteTable(
  "financial_account_identifiers",
  {
    id: text("id").$type<FinancialAccountIdentifierId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    accountId: text("account_id").$type<FinancialAccountId>().notNull(),
    scope: text("scope").notNull(),
    value: text("value").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_financial_account_identifier")
      .on(table.userId, table.accountId, table.scope, table.value)
      .where(sql`${table.deletedAt} is null`),
    index("idx_financial_account_identifiers_account").on(table.accountId),
  ]
);

export const captureEvidence = sqliteTable(
  "capture_evidence",
  {
    id: text("id").$type<CaptureEvidenceId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    sourceFamily: text("source_family").notNull(),
    evidenceType: text("evidence_type").notNull(),
    scope: text("scope").notNull(),
    value: text("value").notNull(),
    transactionId: text("transaction_id").$type<TransactionId>(),
    transferId: text("transfer_id").$type<TransferId>(),
    processedSourceEventId: text("processed_source_event_id")
      .$type<ProcessedSourceEventId>()
      .notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    check(
      "ck_capture_evidence_financial_link",
      sql`${table.transactionId} is null or ${table.transferId} is null`
    ),
    uniqueIndex("uq_capture_evidence_source_event")
      .on(table.userId, table.processedSourceEventId, table.scope, table.value)
      .where(sql`${table.processedSourceEventId} is not null and ${table.deletedAt} is null`),
    index("idx_capture_evidence_user_scope_value").on(table.userId, table.scope, table.value),
    index("idx_capture_evidence_transaction").on(table.transactionId),
    index("idx_capture_evidence_transfer").on(table.transferId),
    index("idx_capture_evidence_processed_source_event").on(table.processedSourceEventId),
    index("idx_capture_evidence_user_updated").on(table.userId, table.updatedAt),
  ]
);

export const processedSourceEvents = sqliteTable(
  "processed_source_events",
  {
    id: text("id").$type<ProcessedSourceEventId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    sourceFamily: text("source_family").notNull(),
    sourceId: text("source_id").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: text("next_retry_at").$type<IsoDateTime>(),
    transactionId: text("transaction_id").$type<TransactionId>(),
    confidence: real("confidence"),
    receivedAt: text("received_at").$type<IsoDateTime>().notNull(),
    processedAt: text("processed_at").$type<IsoDateTime>().notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_processed_source_event")
      .on(table.userId, table.sourceFamily, table.sourceId, table.sourceEventId)
      .where(sql`${table.deletedAt} is null`),
    index("idx_processed_source_events_user_status").on(table.userId, table.status),
    index("idx_processed_source_events_retry_due").on(
      table.userId,
      table.sourceFamily,
      table.status,
      table.nextRetryAt
    ),
    index("idx_processed_source_events_user_updated").on(table.userId, table.updatedAt),
  ]
);

export const emailParseImprovementSamples = sqliteTable(
  "email_parse_improvement_samples",
  {
    id: text("id").$type<EmailParseImprovementSampleId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    template: text("template").notNull(),
    senderDomain: text("sender_domain"),
    source: text("source").notNull(),
    status: text("status").notNull(),
    confidence: real("confidence"),
    parseMethod: text("parse_method").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    sharedAt: text("shared_at").$type<IsoDateTime>(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_email_parse_improvement_sample").on(
      table.userId,
      table.source,
      table.status,
      table.parseMethod,
      sql`coalesce(${table.senderDomain}, '')`,
      table.template
    ),
    index("idx_email_parse_improvement_samples_pending").on(
      table.userId,
      table.sharedAt,
      table.deletedAt,
      table.createdAt,
      table.id
    ),
  ]
);

export const captureImprovementDeletionRequests = sqliteTable(
  "capture_improvement_deletion_requests",
  {
    userId: text("user_id").$type<UserId>().primaryKey(),
    requestedAt: text("requested_at").$type<IsoDateTime>().notNull(),
    lastAttemptAt: text("last_attempt_at").$type<IsoDateTime>(),
  }
);

export const reviewCandidates = sqliteTable(
  "review_candidates",
  {
    id: text("id").$type<ReviewCandidateId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    processedSourceEventId: text("processed_source_event_id")
      .$type<ProcessedSourceEventId>()
      .notNull(),
    status: text("status").notNull(),
    candidateKind: text("candidate_kind").notNull(),
    occurredAt: text("occurred_at").$type<IsoDate>(),
    amount: integer("amount").$type<CopAmount>(),
    currency: text("currency").notNull().default("COP"),
    transactionType: text("transaction_type").$type<"expense" | "income">(),
    categoryId: text("category_id").$type<CategoryId>(),
    description: text("description"),
    confidence: real("confidence"),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_review_candidates_user_status").on(table.userId, table.status),
    index("idx_review_candidates_source_event").on(table.processedSourceEventId),
    index("idx_review_candidates_user_updated").on(table.userId, table.updatedAt),
  ]
);

export const reviewCandidateCaptureEvidence = sqliteTable(
  "review_candidate_capture_evidence",
  {
    id: text("id").$type<ReviewCandidateCaptureEvidenceId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    reviewCandidateId: text("review_candidate_id").$type<ReviewCandidateId>().notNull(),
    captureEvidenceId: text("capture_evidence_id").$type<CaptureEvidenceId>().notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_review_candidate_capture_evidence")
      .on(table.userId, table.reviewCandidateId, table.captureEvidenceId)
      .where(sql`${table.deletedAt} is null`),
    index("idx_review_candidate_capture_evidence_user").on(table.userId),
    index("idx_review_candidate_capture_evidence_candidate").on(table.reviewCandidateId),
    index("idx_review_candidate_capture_evidence_evidence").on(table.captureEvidenceId),
  ]
);

export const accountSuggestionDismissals = sqliteTable(
  "account_suggestion_dismissals",
  {
    id: text("id").$type<AccountSuggestionDismissalId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    scope: text("scope").notNull(),
    value: text("value").notNull(),
    dismissedScore: integer("dismissed_score").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    uniqueIndex("uq_account_suggestion_dismissals_scope")
      .on(table.userId, table.scope, table.value)
      .where(sql`${table.deletedAt} is null`),
    index("idx_account_suggestion_dismissals_user_updated").on(table.userId, table.updatedAt),
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
  (table) => [
    index("idx_email_accounts_user").on(table.userId),
    uniqueIndex("uq_email_accounts_user_email").on(table.userId, table.email),
  ]
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

export const categoryIconOverrides = sqliteTable(
  "category_icon_overrides",
  {
    id: text("id").$type<CategoryIconOverrideId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    categoryId: text("category_id").$type<CategoryId>().notNull(),
    emoji: text("emoji").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_category_icon_overrides_user").on(table.userId),
    uniqueIndex("uq_category_icon_overrides_user_category").on(table.userId, table.categoryId),
  ]
);

export const categoryColorOverrides = sqliteTable(
  "category_color_overrides",
  {
    id: text("id").$type<CategoryColorOverrideId>().primaryKey(),
    userId: text("user_id").$type<UserId>().notNull(),
    categoryId: text("category_id").$type<CategoryId>().notNull(),
    colorHex: text("color_hex").notNull(),
    createdAt: text("created_at").$type<IsoDateTime>().notNull(),
    updatedAt: text("updated_at").$type<IsoDateTime>().notNull(),
    deletedAt: text("deleted_at").$type<IsoDateTime>(),
  },
  (table) => [
    index("idx_category_color_overrides_user").on(table.userId),
    uniqueIndex("uq_category_color_overrides_user_category").on(table.userId, table.categoryId),
  ]
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
