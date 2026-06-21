import type { MutationCommand } from "./commands";

export type MutationPolicy = "local-only" | "ledger-backed";

const MUTATION_POLICY: Record<MutationCommand["kind"], MutationPolicy> = {
  "transaction.save": "ledger-backed",
  "transaction.delete": "ledger-backed",
  "goal.save": "ledger-backed",
  "goal.update": "ledger-backed",
  "goal.delete": "ledger-backed",
  "goalContribution.save": "ledger-backed",
  "goalContribution.delete": "ledger-backed",
  "budget.save": "ledger-backed",
  "budget.update": "ledger-backed",
  "budget.delete": "ledger-backed",
  "budget.copy": "ledger-backed",
  "notification.insert": "ledger-backed",
  "notification.clearAll": "ledger-backed",
  "category.save": "ledger-backed",
  "categoryIconOverride.save": "ledger-backed",
  "categoryIconOverride.clear": "ledger-backed",
  "categoryColorOverride.save": "ledger-backed",
  "categoryColorOverride.clear": "ledger-backed",
  "calendar.bill.save": "local-only",
  "calendar.bill.update": "local-only",
  "calendar.bill.delete": "local-only",
  "calendar.bill.markPaid": "ledger-backed",
  "calendar.bill.unmarkPaid": "ledger-backed",
  "localLedger.reviewCandidate.create": "local-only",
  "localLedger.reviewCandidate.resolve": "local-only",
};

export function getMutationPolicy(kind: MutationCommand["kind"]): MutationPolicy {
  return MUTATION_POLICY[kind];
}
