import { focusManager } from "@tanstack/react-query";
import { AppState } from "@/shared/components/rn";
import { useSubscription } from "@/shared/hooks";

export function useReactQueryFocusManager(): void {
  useSubscription(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });

    return () => subscription.remove();
  }, []);
}
