import { Effect } from "effect";
import { fromThunk } from "@/shared/effect/runtime";
import { EmailPipelineDeps } from "./runtime";
import type { TrackSavedTransactionInput } from "./types";

export function trackSavedTransactionEffect(input: TrackSavedTransactionInput) {
  return Effect.catchAll(
    Effect.flatMap(EmailPipelineDeps.tag, ({ trackTransactionCreated }) =>
      fromThunk(() =>
        trackTransactionCreated({
          type: input.parsed.type,
          category: String(input.categoryId),
          source: "email",
        })
      )
    ),
    () => Effect.succeed(undefined)
  );
}
