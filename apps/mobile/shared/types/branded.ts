export type Brand<T, B extends string> = T & { readonly __brand: B };

// Entity IDs
export type TransactionId = Brand<string, "TransactionId">;
export type BudgetId = Brand<string, "BudgetId">;
export type BillId = Brand<string, "BillId">;
export type BillPaymentId = Brand<string, "BillPaymentId">;
export type CategoryId = Brand<string, "CategoryId">;
export type FinancialAccountId = Brand<string, "FinancialAccountId">;
export type FinancialAccountIdentifierId = Brand<string, "FinancialAccountIdentifierId">;
export type UserId = Brand<string, "UserId">;
export type ChatSessionId = Brand<string, "ChatSessionId">;
export type ChatMessageId = Brand<string, "ChatMessageId">;
export type UserMemoryId = Brand<string, "UserMemoryId">;
export type EmailAccountId = Brand<string, "EmailAccountId">;
export type SyncQueueId = Brand<string, "SyncQueueId">;
export type SyncConflictId = Brand<string, "SyncConflictId">;
export type TransferId = Brand<string, "TransferId">;
export type MerchantRuleId = Brand<string, "MerchantRuleId">;
export type NotificationSourceId = Brand<string, "NotificationSourceId">;
export type OpeningBalanceId = Brand<string, "OpeningBalanceId">;
export type ProcessedCaptureId = Brand<string, "ProcessedCaptureId">;
export type ProcessedEmailId = Brand<string, "ProcessedEmailId">;
export type DetectedSmsEventId = Brand<string, "DetectedSmsEventId">;
export type UserCategoryId = Brand<string, "UserCategoryId">;
export type NotificationId = Brand<string, "NotificationId">;
// Server-generated (Supabase gen_random_uuid()) — no client-side generator needed
export type PushDeviceId = Brand<string, "PushDeviceId">;

// Temporal
export type Month = Brand<string, "Month">; // "YYYY-MM"
export type IsoDate = Brand<string, "IsoDate">; // "YYYY-MM-DD"
export type IsoDateTime = Brand<string, "IsoDateTime">; // full ISO 8601

// Money
export type CopAmount = Brand<number, "CopAmount">;
