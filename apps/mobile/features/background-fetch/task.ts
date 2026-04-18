import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import {
  fetchAndProcessEmails,
  getGmailClientId,
  getOutlookClientId,
  initializeEmailCaptureSession,
  loadEmailAccounts,
} from "@/features/email-capture";
import { getDb, getSupabase } from "@/shared/db";
import { captureError } from "@/shared/lib";
import { requireUserId } from "@/shared/types/assertions";

export const BACKGROUND_TASK_NAME = "FIDY_EMAIL_FETCH";

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error || !data.session) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const userId = requireUserId(data.session.user.id);
    const db = getDb(userId);
    initializeEmailCaptureSession(userId);
    await loadEmailAccounts(db, userId);

    await fetchAndProcessEmails(db, userId, getGmailClientId(), getOutlookClientId());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    captureError(error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
