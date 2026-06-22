import { aiChatBootstrapTask } from "@/features/ai-chat/bootstrap";
import {
  analyticsBootstrapTask,
  analyticsTransactionSubscriptionTask,
} from "@/features/analytics/bootstrap";
import { backgroundFetchBootstrapTask } from "@/features/background-fetch/bootstrap";
import {
  budgetBootstrapTask,
  budgetTransactionSubscriptionTask,
} from "@/features/budget/bootstrap";
import { calendarBootstrapTask } from "@/features/calendar/bootstrap";
import {
  captureSourcesBootstrapTask,
  useCaptureSourcesBootstrap,
} from "@/features/capture-sources/bootstrap";
import { categoriesBootstrapTask } from "@/features/categories/bootstrap";
import {
  cloudLedgerBootstrapTask,
  cloudLedgerReconnectFlushTask,
} from "@/features/cloud-ledger/bootstrap";
import {
  emailCaptureMaintenanceBootstrapTask,
  useEmailCaptureBootstrap,
} from "@/features/email-capture/bootstrap";
import { goalsBootstrapTask, goalsTransactionSubscriptionTask } from "@/features/goals/bootstrap";
import {
  notificationsBootstrapTask,
  useNotificationBootstrap,
} from "@/features/notifications/bootstrap";
import { settingsBootstrapTask } from "@/features/settings/bootstrap";
import { transactionBootstrapTask } from "@/features/transactions/bootstrap";
import { runBootstrapTasks, subscribeBootstrapTasks } from "@/shared/bootstrap/registry";
import type {
  AuthenticatedBootstrapContext,
  CapturePipelineContext,
  NotificationBootstrapContext,
} from "@/shared/bootstrap/types";

const AUTHENTICATED_BOOTSTRAP_TASKS = [
  transactionBootstrapTask,
  aiChatBootstrapTask,
  calendarBootstrapTask,
  budgetBootstrapTask,
  goalsBootstrapTask,
  analyticsBootstrapTask,
  cloudLedgerBootstrapTask,
  notificationsBootstrapTask,
  categoriesBootstrapTask,
  captureSourcesBootstrapTask,
  settingsBootstrapTask,
  backgroundFetchBootstrapTask,
] as const;

const AUTHENTICATED_MAINTENANCE_BOOTSTRAP_TASKS = [emailCaptureMaintenanceBootstrapTask] as const;

const AUTHENTICATED_TRANSACTION_SUBSCRIPTIONS = [
  cloudLedgerReconnectFlushTask,
  budgetTransactionSubscriptionTask,
  goalsTransactionSubscriptionTask,
  analyticsTransactionSubscriptionTask,
] as const;

export const runAuthenticatedBootstrap = (context: AuthenticatedBootstrapContext): Promise<void> =>
  runBootstrapTasks(context, AUTHENTICATED_BOOTSTRAP_TASKS);

export const runAuthenticatedMaintenanceBootstrap = (
  context: AuthenticatedBootstrapContext
): Promise<void> => runBootstrapTasks(context, AUTHENTICATED_MAINTENANCE_BOOTSTRAP_TASKS);

export const subscribeAuthenticatedTransactionRefreshes = (
  context: AuthenticatedBootstrapContext
): (() => void) => subscribeBootstrapTasks(context, AUTHENTICATED_TRANSACTION_SUBSCRIPTIONS);

export const useAuthenticatedCapturePipelines = (context: CapturePipelineContext): void => {
  useEmailCaptureBootstrap(context);
  useCaptureSourcesBootstrap(context);
};

export const useAuthenticatedNotificationBootstrap = (
  context: NotificationBootstrapContext
): void => {
  useNotificationBootstrap(context);
};
