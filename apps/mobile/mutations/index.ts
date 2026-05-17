/* eslint-disable no-restricted-imports */

import type { BudgetRow as RepoBudgetRow } from "@/features/budget/lib/repository";
import type {
  BillPaymentRow as RepoBillPaymentRow,
  BillRow as RepoBillRow,
} from "@/features/calendar/lib/repository";
import type { UserCategoryRow as RepoUserCategoryRow } from "@/features/categories/lib/repository";
import type {
  GoalContributionRow as RepoGoalContributionRow,
  GoalRow as RepoGoalRow,
} from "@/features/goals/lib/repository";
import type { NotificationRow as RepoNotificationRow } from "@/features/notifications/repository";
import type { TransactionRow as RepoTransactionRow } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import {
  createReviewCandidateUseCase,
  type CreateReviewCandidateInput,
} from "@/local-ledger/intake.public";
import {
  createGenericWriteThroughMutationModule,
  getMutationPolicy,
  type MutationCommand,
  type MutationOutcome,
  type WriteThroughMutationModule,
} from "@/shared/mutations";
import type { MutationDb } from "@/shared/mutations/write-through";
import { budgetHandlers } from "../mutation-runtime/budget-handlers";
import { calendarHandlers } from "../mutation-runtime/calendar-handlers";
import { categoryHandlers } from "../mutation-runtime/category-handlers";
import type { MutationHandlerRegistry } from "../mutation-runtime/common";
import { goalHandlers } from "../mutation-runtime/goal-handlers";
import { notificationHandlers } from "../mutation-runtime/notification-handlers";
import { localLedgerHandlers } from "../mutation-runtime/local-ledger-handlers";
import { transactionHandlers } from "../mutation-runtime/transaction-handlers";

const mutationHandlers: MutationHandlerRegistry = {
  ...transactionHandlers,
  ...goalHandlers,
  ...budgetHandlers,
  ...notificationHandlers,
  ...categoryHandlers,
  ...calendarHandlers,
  ...localLedgerHandlers,
};

const applyCommand = (db: MutationDb, command: MutationCommand) =>
  mutationHandlers[command.kind](db, command as never);

export function createWriteThroughMutationModule(db: AnyDb): WriteThroughMutationModule {
  return createGenericWriteThroughMutationModule(db, applyCommand);
}

export const createReviewCandidateWithLocalLedger = (
  db: AnyDb,
  input: CreateReviewCandidateInput
) =>
  createReviewCandidateUseCase({
    commit: (command) => createWriteThroughMutationModule(db).commit(command as never),
  })(input);

export {
  getMutationPolicy,
  type MutationOutcome,
  type WriteThroughMutationModule,
  type RepoNotificationRow as NotificationRow,
  type RepoTransactionRow as TransactionRow,
  type RepoUserCategoryRow as UserCategoryRow,
  type RepoBudgetRow as BudgetRow,
  type RepoBillRow as BillRow,
  type RepoBillPaymentRow as BillPaymentRow,
  type RepoGoalRow as GoalRow,
  type RepoGoalContributionRow as GoalContributionRow,
};
