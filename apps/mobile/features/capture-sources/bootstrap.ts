import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext, CapturePipelineContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { useApplePayCapture } from "./hooks/useApplePayCapture";
import { useNotificationCapture } from "./hooks/useNotificationCapture";
import { useSmsDetection } from "./hooks/useSmsDetection";
import { useWidgetCapture } from "./hooks/useWidgetCapture";
import { hydrateCaptureSources } from "./public";

export const captureSourcesBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "capture-sources",
  run: ({ db, userId }) => {
    void hydrateCaptureSources(db, userId).catch(
      handleRecoverableError("Failed to load capture sources")
    );
  },
};

export const useCaptureSourcesBootstrap = ({ db, userId }: CapturePipelineContext): void => {
  useNotificationCapture(db, userId);
  useApplePayCapture(db, userId);
  useSmsDetection(db, userId);
  useWidgetCapture(db, userId);
};
