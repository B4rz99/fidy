import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { captureError } from "@/shared/lib";
import { registerBackgroundTask } from "./public";

export const backgroundFetchBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "background-fetch",
  isEnabled: ({ enableRemoteEffects }) => enableRemoteEffects,
  run: () => {
    void registerBackgroundTask().catch(captureError);
  },
};
