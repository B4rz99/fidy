import type {
  BillId,
  BillPaymentId,
  BudgetId,
  ChatMessageId,
  ChatSessionId,
  DetectedSmsEventId,
  EmailAccountId,
  FinancialAccountId,
  FinancialAccountIdentifierId,
  MerchantRuleId,
  NotificationId,
  NotificationSourceId,
  OpeningBalanceId,
  ProcessedCaptureId,
  ProcessedEmailId,
  SyncConflictId,
  SyncQueueId,
  TransactionId,
  TransferId,
  UserCategoryId,
  UserMemoryId,
} from "@/shared/types/branded";

/** Pure ID builder — all inputs explicit. */
function buildId(prefix: string, timestamp: number, entropy: string): string {
  return `${prefix}-${timestamp}-${entropy}`;
}

/** Convenience wrapper — impure by design (ID generation requires uniqueness). */
export function generateId(prefix: string): string {
  return buildId(prefix, Date.now(), Math.random().toString(36).slice(2, 7));
}

// === Typed ID generators (one per entity) ===

export function generateTransactionId(): TransactionId {
  return generateId("txn") as TransactionId;
}

export function generateBudgetId(): BudgetId {
  return generateId("budget") as BudgetId;
}

export function generateBillId(): BillId {
  return generateId("bill") as BillId;
}

export function generateBillPaymentId(): BillPaymentId {
  return generateId("bp") as BillPaymentId;
}

export function generateSyncQueueId(): SyncQueueId {
  return generateId("sq") as SyncQueueId;
}

export function generateChatSessionId(): ChatSessionId {
  return generateId("session") as ChatSessionId;
}

export function generateChatMessageId(): ChatMessageId {
  return generateId("msg") as ChatMessageId;
}

export function generateUserMemoryId(): UserMemoryId {
  return generateId("memory") as UserMemoryId;
}

export function generateEmailAccountId(): EmailAccountId {
  return generateId("ea") as EmailAccountId;
}

export function generateFinancialAccountId(): FinancialAccountId {
  return generateId("fa") as FinancialAccountId;
}

export function generateFinancialAccountIdentifierId(): FinancialAccountIdentifierId {
  return generateId("fai") as FinancialAccountIdentifierId;
}

export function generateSyncConflictId(): SyncConflictId {
  return generateId("sc") as SyncConflictId;
}

export function generateTransferId(): TransferId {
  return generateId("tr") as TransferId;
}

export function generateMerchantRuleId(): MerchantRuleId {
  return generateId("mr") as MerchantRuleId;
}

export function generateNotificationSourceId(): NotificationSourceId {
  return generateId("ns") as NotificationSourceId;
}

export function generateOpeningBalanceId(): OpeningBalanceId {
  return generateId("ob") as OpeningBalanceId;
}

export function generateProcessedCaptureId(): ProcessedCaptureId {
  return generateId("pc") as ProcessedCaptureId;
}

export function generateProcessedEmailId(): ProcessedEmailId {
  return generateId("pe") as ProcessedEmailId;
}

export function generateDetectedSmsEventId(): DetectedSmsEventId {
  return generateId("sms") as DetectedSmsEventId;
}

export function generateUserCategoryId(): UserCategoryId {
  return generateId("ucat") as UserCategoryId;
}

export function generateNotificationId(): NotificationId {
  return generateId("nf") as NotificationId;
}
