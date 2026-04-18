import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { RawEmail } from "./schema";
import type { PipelineResult, ProgressCallback, RetryResult } from "./services/email-pipeline";
import {
  processEmails as processEmailsInternal,
  processRetries as processRetriesInternal,
} from "./services/email-pipeline";

export type { RawEmail } from "./schema";
export type {
  PipelineResult,
  ProgressCallback,
  RetryResult,
} from "./services/email-pipeline";

export type ProcessEmails = (
  db: AnyDb,
  userId: UserId,
  rawEmails: RawEmail[],
  onProgress?: ProgressCallback
) => Promise<PipelineResult>;

export type ProcessRetries = (db: AnyDb, userId: UserId) => Promise<RetryResult>;

export const processEmails: ProcessEmails = (db, userId, rawEmails, onProgress) =>
  processEmailsInternal(db, userId, rawEmails, onProgress);

export const processRetries: ProcessRetries = (db, userId) => processRetriesInternal(db, userId);
