import { isLocalQaProfile, type LocalQaProfile } from "../local-session";

export const QA_TARGETS = {
  home: "/(tabs)/(index)",
  addChooser: "/(tabs)/add",
  onboarding: "/(auth)/onboarding",
  addTransaction: "/add-transaction",
  addTransfer: "/add-transfer",
  transferConflict: "/qa-transfer-conflict",
  financialAccounts: "/financial-accounts",
  profile: "/profile",
  qaTools: "/qa-tools",
} as const;

export type QaTarget = (typeof QA_TARGETS)[keyof typeof QA_TARGETS];

export const QA_TARGET_KEYS = {
  home: "home",
  addChooser: "add-chooser",
  onboarding: "onboarding",
  addTransaction: "add-transaction",
  addTransfer: "add-transfer",
  transferConflict: "transfer-conflict",
  financialAccounts: "financial-accounts",
  profile: "profile",
  qaTools: "qa-tools",
} as const;

export type QaTargetKey = (typeof QA_TARGET_KEYS)[keyof typeof QA_TARGET_KEYS];

const QA_TARGET_VALUES = Object.values(QA_TARGETS);
const QA_TARGET_KEY_VALUES = Object.values(QA_TARGET_KEYS);
const QA_TARGET_BY_KEY: Record<QaTargetKey, QaTarget> = {
  [QA_TARGET_KEYS.home]: QA_TARGETS.home,
  [QA_TARGET_KEYS.addChooser]: QA_TARGETS.addChooser,
  [QA_TARGET_KEYS.onboarding]: QA_TARGETS.onboarding,
  [QA_TARGET_KEYS.addTransaction]: QA_TARGETS.addTransaction,
  [QA_TARGET_KEYS.addTransfer]: QA_TARGETS.addTransfer,
  [QA_TARGET_KEYS.transferConflict]: QA_TARGETS.transferConflict,
  [QA_TARGET_KEYS.financialAccounts]: QA_TARGETS.financialAccounts,
  [QA_TARGET_KEYS.profile]: QA_TARGETS.profile,
  [QA_TARGET_KEYS.qaTools]: QA_TARGETS.qaTools,
};
const DEFAULT_QA_TARGET_BY_PROFILE = {
  default: QA_TARGETS.home,
  empty: QA_TARGETS.onboarding,
  "home-activity": QA_TARGETS.home,
  "transfer-ready": QA_TARGETS.addTransfer,
  "transfer-conflict": QA_TARGETS.transferConflict,
  "two-accounts": QA_TARGETS.financialAccounts,
} satisfies Record<LocalQaProfile, QaTarget>;

export { isLocalQaProfile };

export function isQaTarget(value: string | null | undefined): value is QaTarget {
  return QA_TARGET_VALUES.includes(value as QaTarget);
}

export function isQaTargetKey(value: string | null | undefined): value is QaTargetKey {
  return QA_TARGET_KEY_VALUES.includes(value as QaTargetKey);
}

export function getQaTargetFromKey(key: QaTargetKey): QaTarget {
  return QA_TARGET_BY_KEY[key];
}

export function getDefaultQaTarget(profile: LocalQaProfile): QaTarget {
  return DEFAULT_QA_TARGET_BY_PROFILE[profile];
}
