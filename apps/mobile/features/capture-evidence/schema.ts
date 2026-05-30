import { z } from "zod";
import { CAPTURE_EVIDENCE_TYPES } from "@/shared/capture-evidence/types";

const captureEvidenceTypeSchema = z.enum(CAPTURE_EVIDENCE_TYPES);
export type { CaptureEvidenceSeed, CaptureEvidenceType } from "@/shared/capture-evidence/types";
