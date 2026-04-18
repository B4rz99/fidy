import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren, ReactNode } from "react";
import { queryClient } from "./client";
import { useReactQueryFocusManager } from "./focus";

export function QueryProvider({ children }: PropsWithChildren): ReactNode {
  useReactQueryFocusManager();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
