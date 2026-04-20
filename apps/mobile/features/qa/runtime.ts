import { useMountEffect } from "@/shared/hooks";
import { recordQaLog } from "./logging";
import { installQaFetchInspector } from "./network-inspector";

export function useQaDevtoolsRuntime() {
  useMountEffect(() => {
    const uninstall = installQaFetchInspector();
    recordQaLog("info", "qa_runtime_ready");
    return uninstall;
  });
}
