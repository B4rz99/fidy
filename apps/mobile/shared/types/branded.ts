export type Brand<T, B extends string> = T & { readonly __brand: B };

// Entity IDs
export type TransactionId = Brand<string, "TransactionId">;
export type BudgetId = Brand<string, "BudgetId">;
export type BillId = Brand<string, "BillId">;
export type BillPaymentId = Brand<string, "BillPaymentId">;
export type CategoryId = Brand<string, "CategoryId">;
export type AccountSuggestionDismissalId = Brand<string, "AccountSuggestionDismissalId">;
export type CaptureEvidenceId = Brand<string, "CaptureEvidenceId">;
export type FinancialAccountId = Brand<string, "FinancialAccountId">;
export type FinancialAccountIdentifierId = Brand<string, "FinancialAccountIdentifierId">;
export type UserId = Brand<string, "UserId">;
export type ChatSessionId = Brand<string, "ChatSessionId">;
export type ChatMessageId = Brand<string, "ChatMessageId">;
export type EmailAccountId = Brand<string, "EmailAccountId">;
export type EmailParseImprovementSampleId = Brand<string, "EmailParseImprovementSampleId">;
export type TransferId = Brand<string, "TransferId">;
export type MerchantRuleId = Brand<string, "MerchantRuleId">;
export type NotificationSourceId = Brand<string, "NotificationSourceId">;
export type OpeningBalanceId = Brand<string, "OpeningBalanceId">;
export type ProcessedSourceEventId = Brand<string, "ProcessedSourceEventId">;
export type ReviewCandidateId = Brand<string, "ReviewCandidateId">;
export type ReviewCandidateCaptureEvidenceId = Brand<string, "ReviewCandidateCaptureEvidenceId">;
export type DetectedSmsEventId = Brand<string, "DetectedSmsEventId">;
export type UserCategoryId = Brand<string, "UserCategoryId">;
export type NotificationId = Brand<string, "NotificationId">;
export type BackupId = Brand<string, "BackupId">;
// Server-generated (Supabase gen_random_uuid()) — no client-side generator needed
export type PushDeviceId = Brand<string, "PushDeviceId">;

// Temporal
export type Month = Brand<string, "Month">; // "YYYY-MM"
export type IsoDate = Brand<string, "IsoDate">; // "YYYY-MM-DD"
export type IsoDateTime = Brand<string, "IsoDateTime">; // full ISO 8601

// Money
export type CopAmount = Brand<number, "CopAmount">;
