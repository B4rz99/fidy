import type { CapturePipelineContext } from "@/shared/bootstrap/types";
import { useEmailCapture } from "./hooks/useEmailCapture";

export const useEmailCaptureBootstrap = ({ db, userId }: CapturePipelineContext): void => {
  useEmailCapture(db, userId);
};
