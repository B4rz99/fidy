import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  type AttributionReviewItem,
  createAttributionReviewService,
} from "@/features/review-queues/lib/attribution-review-service";
import type { AnyDb } from "@/shared/db";
import { isMissingSqliteTableError } from "@/shared/lib/sqlite-errors";
import type { UserId } from "@/shared/types/branded";

export type SuggestedAttributionReviewItem = AttributionReviewItem & {
  readonly suggestedAccount: NonNullable<AttributionReviewItem["suggestedAccount"]>;
  readonly suggestion: NonNullable<AttributionReviewItem["suggestion"]>;
};

type UseAttributionReviewQueueInput = {
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
};

function hasSuggestedOwner(item: AttributionReviewItem): item is SuggestedAttributionReviewItem {
  return item.suggestion != null && item.suggestedAccount != null;
}

export function useAttributionReviewQueue({ db, userId }: UseAttributionReviewQueueInput) {
  const service = useMemo(() => createAttributionReviewService(), []);
  const [items, setItems] = useState<readonly SuggestedAttributionReviewItem[]>([]);
  const [hasLoadedQueue, setHasLoadedQueue] = useState(false);

  const reloadQueue = useCallback(() => {
    if (!db || !userId) {
      setItems([]);
      setHasLoadedQueue(true);
      return;
    }

    try {
      setItems(service.listQueueItems({ db, userId }).filter(hasSuggestedOwner));
    } catch (error) {
      if (isMissingSqliteTableError(error)) {
        setItems([]);
      } else {
        throw error;
      }
    }

    setHasLoadedQueue(true);
  }, [db, service, userId]);

  useFocusEffect(reloadQueue);

  return {
    items,
    hasLoadedQueue,
    reloadQueue,
    service,
  };
}
