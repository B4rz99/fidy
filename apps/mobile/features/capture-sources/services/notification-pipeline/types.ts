import type { CaptureEvidenceSeed } from "@/features/capture-evidence/public";
import type { AnyDb } from "@/shared/db";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { NotificationData, resolveSource } from "../../schema";

export type NotificationParseMethod = "regex" | "llm";
export type NotificationSource = ReturnType<typeof resolveSource>;
export type NotificationStageMetrics = {
  saved: 0 | 1;
  skippedDuplicate: 0 | 1;
  parseFailed: 0 | 1;
};

export type RawParsedNotification = {
  amount: number;
  merchant: string;
  type: "expense" | "income";
  categoryId: string;
  date: string;
  confidence: number;
};

export type ParsedNotification = Omit<RawParsedNotification, "amount" | "date"> & {
  amount: CopAmount;
  date: IsoDate;
};

export type NotificationCommand = {
  db: AnyDb;
  userId: UserId;
  notification: NotificationData;
};

export type NotificationContext = NotificationCommand & {
  captureEvidence: readonly CaptureEvidenceSeed[];
  notificationText: string;
  sanitizedText: string;
  receivedAt: IsoDateTime;
  source: NotificationSource;
  notificationDate: IsoDate;
};

export type NotificationStageContext = NotificationContext & {
  parseMethod: NotificationParseMethod;
};

export type ParsedNotificationContext = NotificationStageContext & {
  parsed: ParsedNotification;
  fingerprint: string;
};

export type ResolvedNotificationContext = ParsedNotificationContext & {
  merchantKey: string;
  categoryId: CategoryId;
  accountId: FinancialAccountId;
  accountAttributionState: "inferred" | "unresolved";
  now: IsoDateTime;
};

export type ParseStageResult =
  | { kind: "failed"; context: NotificationStageContext }
  | { kind: "parsed"; context: ParsedNotificationContext };

export type DuplicateCheckResult =
  | { kind: "already_processed" }
  | { kind: "cross_source"; transactionId: TransactionId };

export type PersistedCaptureOutcome = {
  status: "failed" | "skipped_duplicate" | "success";
  fingerprintHash: string;
  transactionId: TransactionId | null;
  confidence: number | null;
  now: IsoDateTime;
};

export type NotificationPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: TransactionId | null;
};
