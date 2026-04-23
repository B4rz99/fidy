import { processEmailBatch } from "./email-pipeline-service/incoming-batch";
import { processRetryBatch } from "./email-pipeline-service/retry";
import { createPipelineRuntime } from "./email-pipeline-service/runtime";
import type {
  CreateEmailPipelineServiceDeps,
  EmailPipelineService,
  PipelineResult,
  ProcessEmails,
  ProcessRetries,
  ProgressCallback,
  RetryResult,
} from "./email-pipeline-service/types";

export function createEmailPipelineService(
  deps: CreateEmailPipelineServiceDeps
): EmailPipelineService {
  const runtime = createPipelineRuntime(deps);

  return {
    async processEmails(...args: Parameters<EmailPipelineService["processEmails"]>) {
      const [db, userId, rawEmails, onProgress] = args;
      return processEmailBatch(runtime, { db, userId, rawEmails, onProgress });
    },

    async processRetries(db, userId) {
      return processRetryBatch(runtime, { db, userId });
    },
  };
}

export type { PipelineResult, ProcessEmails, ProcessRetries, ProgressCallback, RetryResult };
