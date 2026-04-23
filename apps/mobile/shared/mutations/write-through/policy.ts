import type { MutationCommand } from "./commands";

export type MutationPolicy = "local-only" | "sync-backed";

const MUTATION_POLICY: Record<MutationCommand["kind"], MutationPolicy> = {
  "transaction.save": "sync-backed",
  "transaction.delete": "sync-backed",
  "goal.save": "sync-backed",
  "goal.update": "sync-backed",
  "goal.delete": "sync-backed",
  "goalContribution.save": "sync-backed",
  "goalContribution.delete": "sync-backed",
  "budget.save": "sync-backed",
  "budget.update": "sync-backed",
  "budget.delete": "sync-backed",
  "budget.copy": "sync-backed",
  "notification.insert": "sync-backed",
  "notification.clearAll": "sync-backed",
  "category.save": "sync-backed",
  "calendar.bill.save": "local-only",
  "calendar.bill.update": "local-only",
  "calendar.bill.delete": "local-only",
  "calendar.bill.markPaid": "sync-backed",
  "calendar.bill.unmarkPaid": "sync-backed",
};

export function getMutationPolicy(kind: MutationCommand["kind"]): MutationPolicy {
  return MUTATION_POLICY[kind];
}
