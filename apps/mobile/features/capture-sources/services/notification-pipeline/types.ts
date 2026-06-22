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
  cardProductHint?: string;
  accountTypeHint?: string;
  counterpartyHint?: string;
};

export type RawNotificationNeedsReview = {
  readonly kind: "needs_review";
  readonly reason?: string;
  readonly confidence?: number | null;
};

export type RawNotificationAiUnavailable = {
  readonly kind: "ai_unavailable";
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
  regexParseImprovementTemplate?: string;
};

export type ParsedNotificationContext = NotificationStageContext & {
  parsed: ParsedNotification;
  fingerprint: string;
};

export type ReviewableNotificationContext = NotificationStageContext & {
  readonly review: {
    readonly confidence: number | null;
  };
};

export type AiUnavailableNotificationContext = NotificationStageContext;

export type ResolvedNotificationContext = ParsedNotificationContext & {
  merchantKey: string;
  categoryId: CategoryId;
  accountId: FinancialAccountId;
  accountAttributionState: "inferred" | "unresolved";
  now: IsoDateTime;
};

export type ParseStageResult =
  | { kind: "failed"; context: NotificationStageContext }
  | { kind: "ai_unavailable"; context: AiUnavailableNotificationContext }
  | { kind: "needs_review"; context: ReviewableNotificationContext }
  | { kind: "parsed"; context: ParsedNotificationContext };

export type DuplicateCheckResult =
  | { kind: "already_processed" }
  | { kind: "cross_source"; transactionId: TransactionId };

export type NotificationPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: TransactionId | null;
  parseImprovementRequest?: {
    readonly source: NotificationSource;
    readonly status: "failed" | "needs_review";
    readonly confidence: number | null;
    readonly parseMethod: NotificationParseMethod;
    readonly parserTemplate?: string;
  };
};
