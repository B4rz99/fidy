import * as burnt from "burnt";
import { captureError } from "./sentry";

type AppToastKind = "success";
type AppToast = {
  readonly id: number;
  readonly duration: number;
  readonly kind: AppToastKind;
  readonly message: string;
};

type AppToastListener = (toast: AppToast) => void;

const appToastListeners = new Set<AppToastListener>();
let appToastId = 0;

export function subscribeAppToasts(listener: AppToastListener): () => void {
  appToastListeners.add(listener);
  return () => appToastListeners.delete(listener);
}

function showAppToast(message: string, kind: AppToastKind, duration: number): void {
  appToastId += 1;
  const toast = { id: appToastId, duration, kind, message };
  appToastListeners.forEach((listener) => listener(toast));
}

export function showErrorToast(message: string): void {
  burnt.toast({ title: message, preset: "error" });
}

export function showSuccessToast(message: string, duration?: number): void {
  showAppToast(message, "success", duration ?? 5);
}

export function handleRecoverableError(message: string) {
  return (error: unknown): void => {
    captureError(error);
    showErrorToast(message);
  };
}
