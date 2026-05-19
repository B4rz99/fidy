import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { useSettingsStore } from "./public";

export const settingsBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "settings",
  run: () => {
    if (useSettingsStore.getState().isHydrated) return;

    void useSettingsStore
      .getState()
      .hydrate()
      .catch(handleRecoverableError("Failed to hydrate settings"));
  },
};
