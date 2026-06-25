import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

export type AuthenticatedBootstrapContext = {
  readonly db: AnyDb;
  readonly enableRemoteEffects: boolean;
  readonly isCurrent?: () => boolean;
  readonly userId: UserId;
};

export type CapturePipelineContext = {
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
};

export type NotificationBootstrapContext = {
  readonly enableRemoteEffects: boolean;
  readonly navigateToRoute: (route: string) => void;
  readonly userId: UserId;
};
