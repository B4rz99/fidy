export type { RawEmail } from "./schema";
export {
  type PipelineResult,
  type ProgressCallback,
  processEmails,
  processRetries,
  type RetryResult,
} from "./services/email-pipeline";
