import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { releaseLlmContext } from "@/features/email-capture/services/llm-context";
import { useEmailCaptureStore } from "@/features/email-capture/store";

export const BACKGROUND_FETCH_TASK = "FIDY_EMAIL_FETCH";

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    // Adapters own their config — clientId params are unused in background context
    await useEmailCaptureStore.getState().fetchAndProcess("", "");
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  } finally {
    releaseLlmContext();
  }
});
