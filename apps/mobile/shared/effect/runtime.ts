import { Effect } from "effect";

export type AppEffect<A, E = unknown, R = never> = Effect.Effect<A, E, R>;

export function runAppEffect<A, E>(effect: AppEffect<A, E>): Promise<A> {
  return Effect.runPromise(effect);
}

export function fromThunk<A>(thunk: () => A | Promise<A>): AppEffect<A> {
  return Effect.promise(() => Promise.resolve().then(thunk));
}
