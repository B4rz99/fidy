import type { PipelineResult } from "../pipeline.public";

const EMPTY_PIPELINE_RESULT: PipelineResult = {
  filtered: 0,
  skippedDuplicate: 0,
  skippedCrossSource: 0,
  saved: 0,
  failed: 0,
  pendingRetry: 0,
  needsReview: 0,
  parseImprovementRequests: [],
};

export const aggregatePipelineResults = (results: readonly PipelineResult[]): PipelineResult =>
  results.reduce(
    (total, result) => ({
      filtered: total.filtered + result.filtered,
      skippedDuplicate: total.skippedDuplicate + result.skippedDuplicate,
      skippedCrossSource: total.skippedCrossSource + result.skippedCrossSource,
      saved: total.saved + result.saved,
      failed: total.failed + result.failed,
      pendingRetry: total.pendingRetry + result.pendingRetry,
      needsReview: total.needsReview + result.needsReview,
      parseImprovementRequests: [
        ...total.parseImprovementRequests,
        ...result.parseImprovementRequests,
      ],
    }),
    EMPTY_PIPELINE_RESULT
  );
