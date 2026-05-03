import { shareCaptureParseImprovementSample } from "@/features/capture-sources/diagnostics.public";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type { EmailParseImprovementRequest } from "./email-pipeline-service/types";

export async function shareEmailParseImprovementRequests(input: {
  readonly enabled: boolean;
  readonly userId: UserId;
  readonly requests: readonly EmailParseImprovementRequest[];
}): Promise<void> {
  if (!input.enabled) return;

  await Promise.all(
    input.requests.map((request) =>
      shareCaptureParseImprovementSample({ ...request, userId: input.userId, consent: true }).catch(
        captureError
      )
    )
  );
}
