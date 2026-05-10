import type { LocalQaProfile } from "./local-session";

export { useQaDevtoolsStore } from "./devtools-store";
export { buildLocalQaSeed } from "./lib/build-local-qa-seed";
export { getDefaultQaTarget, isQaTarget, QA_TARGETS, type QaTarget } from "./lib/entry-points";
export {
  clearLocalQaSession,
  isLocalQaAvailable,
  isLocalQaProfile,
  type LocalQaSession,
  loadLocalQaSession,
  persistLocalQaSession,
} from "./local-session";
export type { LocalQaProfile } from "./local-session";
export { recordQaLog } from "./logging";
export { useQaDevtoolsRuntime } from "./runtime";

export async function startLocalQaSession(profile?: LocalQaProfile) {
  const module = await import("./start-local-qa-session");
  return module.startLocalQaSession(profile);
}
