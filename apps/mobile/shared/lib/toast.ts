import * as burnt from "burnt";
import { captureError } from "./sentry";

export function showErrorToast(message: string): void {
  burnt.toast({ title: message, preset: "error" });
}

export function handleRecoverableError(message: string) {
  return (error: unknown): void => {
    captureError(error);
    showErrorToast(message);
  };
}
