import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { AccountCreationSuggestion } from "@/features/account-suggestions/public";
import { createAccountSuggestionService } from "@/features/account-suggestions/public";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

type UseAccountSuggestionsInput = {
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
  readonly limit?: number;
  readonly minimumOccurrences?: number;
};

export function useAccountSuggestions(input: UseAccountSuggestionsInput) {
  const { db, userId, limit, minimumOccurrences } = input;
  const service = useMemo(() => createAccountSuggestionService(), []);
  const [suggestions, setSuggestions] = useState<readonly AccountCreationSuggestion[]>([]);
  const [hasLoadedSuggestions, setHasLoadedSuggestions] = useState(false);

  const reloadSuggestions = useCallback(() => {
    if (!db || !userId) {
      setSuggestions([]);
      setHasLoadedSuggestions(true);
      return;
    }

    setSuggestions(
      service.listSuggestions({
        db,
        userId,
        limit,
        minimumOccurrences,
      })
    );

    setHasLoadedSuggestions(true);
  }, [db, limit, minimumOccurrences, service, userId]);

  useFocusEffect(reloadSuggestions);

  return {
    suggestions,
    hasLoadedSuggestions,
    reloadSuggestions,
  };
}
