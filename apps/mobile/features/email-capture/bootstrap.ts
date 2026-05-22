import * as SecureStore from "expo-secure-store";
import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type {
  AuthenticatedBootstrapContext,
  CapturePipelineContext,
} from "@/shared/bootstrap/types";
import { captureError, captureWarning, toIsoDate } from "@/shared/lib";
import { useEmailCapture } from "./hooks/useEmailCapture";
import { pruneStaleFailedEmailSourceEvents } from "./services/email-parse-improvement-outbox";

const toSecureStoreKeyFragment = (value: string): string =>
  Array.from(value)
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");

const createEmailCapturePruneDateKey = (userId: string): string =>
  `email_capture_last_pruned_on_${toSecureStoreKeyFragment(userId)}`;

const captureMaintenanceFailure =
  (message: string) =>
  (error: unknown): void => {
    captureError(error);
    captureWarning("email_capture_maintenance_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
      operation: message,
    });
  };

export const useEmailCaptureBootstrap = ({ db, userId }: CapturePipelineContext): void => {
  useEmailCapture(db, userId);
};

export const emailCaptureMaintenanceBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "email-capture-maintenance",
  run: async ({ db, userId }) => {
    const today = toIsoDate(new Date());
    const pruneDateKey = createEmailCapturePruneDateKey(userId);
    const lastPrunedOn = await SecureStore.getItemAsync(pruneDateKey).catch((error) => {
      captureMaintenanceFailure("read_prune_date")(error);
      return null;
    });
    if (lastPrunedOn === today) return;

    try {
      pruneStaleFailedEmailSourceEvents({ db, userId });
    } catch (error) {
      captureMaintenanceFailure("prune_stale_failures")(error);
      return;
    }

    await SecureStore.setItemAsync(pruneDateKey, today).catch(
      captureMaintenanceFailure("persist_prune_date")
    );
  },
};
