import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { BACKGROUND_TASK_NAME } from "./task";

export async function registerBackgroundTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
    minimumInterval: 15, // minutes
  });
}

export async function unregisterBackgroundTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
  if (!isRegistered) return;
  await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_NAME);
}
