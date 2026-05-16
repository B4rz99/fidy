import { z } from "zod";
import { CAPTURE_EVIDENCE_TYPES } from "@/shared/capture-evidence/types";

export const captureEvidenceTypeSchema = z.enum(CAPTURE_EVIDENCE_TYPES);
export type CaptureEvidenceType = z.infer<typeof captureEvidenceTypeSchema>;

export type CaptureEvidenceSeed = {
  readonly sourceFamily: string;
  readonly evidenceType: CaptureEvidenceType;
  readonly scope: string;
  readonly value: string;
};
