import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import type { AccountCreationSuggestion } from "@/features/account-suggestions/lib/derive-account-suggestions";
import { createAccountSuggestionService } from "@/features/account-suggestions/services/create-account-suggestion-service";
import type { AnyDb } from "@/shared/db";
import { isMissingSqliteTableError } from "@/shared/lib/sqlite-errors";
import type { UserId } from "@/shared/types/branded";

type UseAccountSuggestionsInput = {
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
  readonly limit?: number;
  readonly minimumOccurrences?: number;
};

export function useAccountSuggestions({
  db,
  userId,
  limit,
  minimumOccurrences,
}: UseAccountSuggestionsInput) {
  const service = useMemo(() => createAccountSuggestionService(), []);
  const [suggestions, setSuggestions] = useState<readonly AccountCreationSuggestion[]>([]);
  const [hasLoadedSuggestions, setHasLoadedSuggestions] = useState(false);

  const reloadSuggestions = useCallback(() => {
    if (!db || !userId) {
      setSuggestions([]);
      setHasLoadedSuggestions(true);
      return;
    }

    try {
      setSuggestions(
        service.listSuggestions({
          db,
          userId,
          limit,
          minimumOccurrences,
        })
      );
    } catch (error) {
      if (isMissingSqliteTableError(error)) {
        setSuggestions([]);
      } else {
        throw error;
      }
    }

    setHasLoadedSuggestions(true);
  }, [db, limit, minimumOccurrences, service, userId]);

  useFocusEffect(reloadSuggestions);

  return {
    suggestions,
    hasLoadedSuggestions,
    reloadSuggestions,
  };
}
