import { useQaDevtoolsStore } from "./devtools-store";
import { isLocalQaAvailable } from "./local-session";

type QaLogContextValue = string | number | boolean | null;

export function recordQaLog(
  level: "info" | "warn" | "error",
  message: string,
  context: Readonly<Record<string, QaLogContextValue>> = {}
) {
  if (!isLocalQaAvailable()) return;

  useQaDevtoolsStore.getState().recordLog({
    level,
    message,
    context,
  });
}
