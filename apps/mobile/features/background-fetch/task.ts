import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { getGmailClientId, getOutlookClientId } from "@/features/email-capture/schema";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { getDb } from "@/shared/db/client";
import { getSupabase } from "@/shared/db/supabase";
import { captureError } from "@/shared/lib/sentry";

export const BACKGROUND_TASK_NAME = "FIDY_EMAIL_FETCH";

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error || !data.session) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const userId = data.session.user.id;
    const db = getDb(userId);
    const store = useEmailCaptureStore.getState();
    store.initStore(db, userId);
    await store.loadAccounts();

    await store.fetchAndProcess(getGmailClientId(), getOutlookClientId());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    captureError(error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
