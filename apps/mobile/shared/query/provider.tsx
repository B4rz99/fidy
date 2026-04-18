import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "./client";
import { useQueryFocusSubscription } from "./focus";

function QueryFocusBridge() {
  useQueryFocusSubscription();
  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryFocusBridge />
      {children}
    </QueryClientProvider>
  );
}
