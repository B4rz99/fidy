import { Context, Effect } from "effect";

export type AppEffect<A, E = unknown, R = never> = Effect.Effect<A, E, R>;

export function runAppEffect<A, E>(effect: AppEffect<A, E>): Promise<A> {
  return Effect.runPromise(effect);
}

export function makeAppTag<Service>(key: string): Context.Tag<Service, Service> {
  return Context.GenericTag<Service>(key);
}

export function runWithService<A, E, I, S>(
  effect: AppEffect<A, E, I>,
  tag: Context.Tag<I, S>,
  service: S
): Promise<A> {
  return runAppEffect(Effect.provideService(effect, tag, service));
}

export function fromSync<A>(thunk: () => A): AppEffect<A> {
  return Effect.try({ try: thunk, catch: (error) => error });
}

export function fromPromise<A>(thunk: () => Promise<A>): AppEffect<A> {
  return Effect.tryPromise({ try: thunk, catch: (error) => error });
}

export function fromThunk<A>(thunk: () => A | Promise<A>): AppEffect<Awaited<A>> {
  return fromPromise(() => Promise.resolve(thunk()));
}
