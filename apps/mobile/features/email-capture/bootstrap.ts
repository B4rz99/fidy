import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext, CapturePipelineContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { useEmailCapture } from "./hooks/useEmailCapture";
import { initializeEmailCaptureSession, loadEmailAccounts } from "./public";

export const emailCaptureBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "email-capture",
  isEnabled: ({ enableRemoteEffects }) => enableRemoteEffects,
  run: ({ db, userId }) => {
    initializeEmailCaptureSession(userId);
    void loadEmailAccounts(db, userId).catch(
      handleRecoverableError("Failed to load email accounts")
    );
  },
};

export const useEmailCaptureBootstrap = ({ db, userId }: CapturePipelineContext): void => {
  useEmailCapture(db, userId);
};
