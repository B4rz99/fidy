export { useQaDevtoolsStore } from "./devtools-store";
export { buildLocalQaSeed } from "./lib/build-local-qa-seed";
export { getDefaultQaTarget, isQaTarget, QA_TARGETS, type QaTarget } from "./lib/entry-points";
export {
  clearLocalQaSession,
  isLocalQaAvailable,
  isLocalQaProfile,
  type LocalQaProfile,
  type LocalQaSession,
  loadLocalQaSession,
  persistLocalQaSession,
} from "./local-session";
export { recordQaLog } from "./logging";
export { useQaDevtoolsRuntime } from "./runtime";

export async function startLocalQaSession(profile?: import("./local-session").LocalQaProfile) {
  const module = await import("./start-local-qa-session");
  return module.startLocalQaSession(profile);
}
