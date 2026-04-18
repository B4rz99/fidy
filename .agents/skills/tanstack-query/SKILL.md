---
name: tanstack-query
description: Use when adding or reviewing TanStack Query in Fidy for remote Supabase or Edge Function data, query caching, invalidation, retries, and mutation flows.
---

# TanStack Query In Fidy

## Use It For

TanStack Query manages **server state**:

- Supabase reads
- Edge Function reads
- remote config and reference data
- per-user remote preferences or profile data
- async mutation flows that should invalidate cached remote data

In Fidy, this usually means data fetched from `@/shared/db/supabase` or `supabase.functions.invoke(...)`.

## Do Not Use It For

Do not use TanStack Query for:

- local SQLite reads
- Zustand UI state
- form field state
- pure derivations in `lib/`
- write-through local mutation orchestration already owned by stores

Fidy split:

- Zustand: local app state, UI state, local DB orchestration
- TanStack Query: remote async state
- `lib/`: pure derivations and pure business rules

## Why It Helps Here

Use TanStack Query when you want to replace custom fetch plumbing with:

- shared cache by query key
- stale/fresh timing via `staleTime`
- deduped concurrent requests
- retries and reconnect refetch
- mutation invalidation
- consistent loading and error state

Good Fidy candidates:

- bank sender list fetched from Supabase
- remote notification preferences
- user memories or other remote AI data
- Edge Function backed reads that should cache briefly

Poor candidates:

- transaction pages from local SQLite
- analytics derived from local SQLite
- budget, goal, and transaction stores that already own local-first behavior

## Install

```bash
npm install @tanstack/react-query
```

Optional devtools are mainly for web and are usually not the first priority for Expo mobile work.

## App Setup

Create a shared `QueryClient` and wrap the app once near the root.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

For React Native, `refetchOnWindowFocus` is not the main refetch trigger. If needed, connect app foreground events with `focusManager`.

```tsx
import { focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });

  return () => subscription.remove();
});
```

## Query Keys

Use serializable array keys. Keep them hierarchical for invalidation.

```ts
["bank-senders"]
["notification-preferences", userId]
["user-memories", userId]
["email-parse", userId, messageId]
```

Rules:

- include the authenticated `userId` when data is user-scoped
- do not hide query inputs inside closures only
- prefer stable primitives in keys
- invalidate by prefix when related data changes

## Preferred Pattern: `queryOptions`

Use `queryOptions` to keep query definitions reusable and typed.

```tsx
import { queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/shared/db";

type BankSenderRow = { bank: string; email: string };

export const bankSendersQueryOptions = queryOptions({
  queryKey: ["bank-senders"] as const,
  queryFn: async ({ signal }): Promise<readonly BankSenderRow[]> => {
    const { data, error } = await getSupabase()
      .from("bank_senders")
      .select("bank, email")
      .abortSignal(signal);

    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60 * 60 * 1000,
});
```

Usage:

```tsx
const query = useQuery(bankSendersQueryOptions);
```

## Query Function Rules

Query functions should:

- fetch only
- throw on failure
- accept cancellation via `signal` when supported
- avoid side effects like analytics, toasts, or store writes

Bad:

```ts
async function fetchPrefs() {
  const data = await remoteCall();
  showToast("loaded");
  useStore.getState().setSomething(data);
  return data;
}
```

Good:

```ts
async function fetchPrefs() {
  const { data, error } = await remoteCall();
  if (error) throw error;
  return data;
}
```

## Mutations

Use `useMutation` for remote writes. Invalidate related queries on success or settle.

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/shared/db";

function useSaveNotificationPreferences(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: {
      budgetAlerts: boolean;
      goalMilestones: boolean;
      spendingAnomalies: boolean;
      weeklyDigest: boolean;
    }) => {
      const { error } = await getSupabase().from("notification_preferences").upsert(
        {
          user_id: userId,
          budget_alerts: prefs.budgetAlerts,
          goal_milestones: prefs.goalMilestones,
          spending_anomalies: prefs.spendingAnomalies,
          weekly_digest: prefs.weeklyDigest,
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["notification-preferences", userId],
      });
    },
  });
}
```

## Optimistic Updates

Use optimistic updates only when the UX benefit is clear and rollback is simple.

Good fits:

- simple toggles
- preference changes
- append/remove on small remote lists

Avoid optimistic updates when:

- server rules may rewrite data substantially
- rollback is hard to compute
- the UI is already fast enough without it

Pattern:

```tsx
const mutation = useMutation({
  mutationFn: updateRemoteThing,
  onMutate: async (nextValue) => {
    await queryClient.cancelQueries({ queryKey: ["thing", nextValue.id] });
    const previous = queryClient.getQueryData(["thing", nextValue.id]);
    queryClient.setQueryData(["thing", nextValue.id], nextValue);
    return { previous };
  },
  onError: (_error, nextValue, context) => {
    queryClient.setQueryData(["thing", nextValue.id], context?.previous);
  },
  onSettled: async (_data, _error, nextValue) => {
    await queryClient.invalidateQueries({ queryKey: ["thing", nextValue.id] });
  },
});
```

## React Native Notes

- prefer `refetchOnReconnect: true`
- usually keep `refetchOnWindowFocus: false` unless you wire `focusManager`
- avoid polling unless the data truly needs it
- use longer `staleTime` for stable reference data to reduce battery and network churn

Suggested starting points:

- stable reference data: `staleTime` 30-60 minutes
- user preferences: `staleTime` 1-5 minutes
- frequently changing user remote data: `staleTime` 0-60 seconds depending on UX need

## Fidy Architecture Guidance

When introducing TanStack Query in this repo:

1. Keep existing local-first Zustand stores for SQLite-backed features.
2. Extract remote fetch logic into pure async functions or `queryOptions` helpers.
3. Use Query only at the remote boundary.
4. Do not mirror Query data into Zustand unless there is a concrete need.
5. If a screen mixes local DB data and remote data, keep them separate rather than forcing one tool to own both.

## Testing

Wrap tested hooks or components with a fresh `QueryClientProvider` per test.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
```

Rules:

- use a new `QueryClient` per test
- set `retry: false` in tests
- assert on observable states, not cache internals unless needed

## Common Mistakes

- using Query for local SQLite state
- copying Query results into Zustand without a strong reason
- omitting `userId` from user-scoped query keys
- keeping side effects inside query functions
- forgetting invalidation after mutations
- using very short `staleTime` for stable reference data
- adding optimistic updates where rollback is messy

## Decision Rule

Ask one question:

"Does this data live remotely and need caching, refetching, or invalidation?"

If yes, TanStack Query is likely a good fit.
If no, keep it in Zustand, SQLite repositories, or pure `lib/` code.
