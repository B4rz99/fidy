import { Cause, Context, Effect, Exit } from "effect";

export type AppEffect<A, E = unknown, R = never> = Effect.Effect<A, E, R>;
export type BoundAppService<I, _S> = {
  readonly provide: <A, E, R>(effect: AppEffect<A, E, I | R>) => AppEffect<A, E, R>;
  readonly run: <A, E>(effect: AppEffect<A, E, I>) => Promise<A>;
};
export type AppService<I, S> = {
  readonly tag: Context.Tag<I, S>;
  readonly bind: (service: S) => BoundAppService<I, S>;
};

export async function runAppEffect<A, E>(effect: AppEffect<A, E>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    throw Cause.squash(exit.cause);
  }
  return exit.value;
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

export function bindAppService<I, S>(tag: Context.Tag<I, S>, service: S): BoundAppService<I, S> {
  return {
    provide: <A, E, R>(effect: AppEffect<A, E, I | R>) =>
      Effect.provideService(effect, tag, service),
    run: <A, E>(effect: AppEffect<A, E, I>) => runWithService(effect, tag, service),
  };
}

export function makeAppService<Service>(key: string): AppService<Service, Service> {
  const tag = makeAppTag<Service>(key);
  return {
    tag,
    bind: (service) => bindAppService(tag, service),
  };
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
