import { focusManager } from "@tanstack/react-query";
import { AppState } from "@/shared/components/rn";
import { useSubscription } from "@/shared/hooks";

export function installQueryFocusSubscription(): () => void {
  const subscription = AppState.addEventListener("change", (status) => {
    focusManager.setFocused(status === "active");
  });

  return () => {
    subscription.remove();
  };
}

export function useQueryFocusSubscription(): void {
  useSubscription(installQueryFocusSubscription, []);
}
