import type { QaFeatureFlagName } from "../../devtools-store";
import { getDefaultQaTarget, type LocalQaProfile, QA_TARGETS, type QaTarget } from "../../index";

export const QA_PROFILES = [
  "default",
  "empty",
  "two-accounts",
  "transfer-ready",
  "transfer-conflict",
] as const satisfies readonly LocalQaProfile[];

export const QA_TARGET_LIST = [
  QA_TARGETS.home,
  QA_TARGETS.addChooser,
  QA_TARGETS.addTransaction,
  QA_TARGETS.addTransfer,
  QA_TARGETS.transferConflict,
  QA_TARGETS.financialAccounts,
  QA_TARGETS.profile,
] as const satisfies readonly QaTarget[];

export const QA_TARGET_LABEL_KEYS: Record<QaTarget, string> = {
  [QA_TARGETS.home]: "home",
  [QA_TARGETS.addChooser]: "addChooser",
  [QA_TARGETS.onboarding]: "onboarding",
  [QA_TARGETS.addTransaction]: "addTransaction",
  [QA_TARGETS.addTransfer]: "addTransfer",
  [QA_TARGETS.transferConflict]: "transferConflict",
  [QA_TARGETS.financialAccounts]: "financialAccounts",
  [QA_TARGETS.profile]: "profile",
  [QA_TARGETS.qaTools]: "qaTools",
};

export const FLAG_KEYS: readonly QaFeatureFlagName[] = [
  "networkInspectorEnabled",
  "logInspectorEnabled",
  "simulateOffline",
  "showQaBanner",
];

export function getResolvedQaTarget(profile: LocalQaProfile, target?: QaTarget) {
  return target ?? getDefaultQaTarget(profile);
}

export function buildAutoStartRequestKey(profile: LocalQaProfile, target?: QaTarget) {
  return JSON.stringify({
    profile,
    target: getResolvedQaTarget(profile, target),
  });
}
