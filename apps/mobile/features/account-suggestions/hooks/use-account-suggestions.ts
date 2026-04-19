import { useFocusEffect } from "@react-navigation/native";
import { useEffectEvent, useMemo, useState } from "react";
import type { AccountCreationSuggestion } from "@/features/account-suggestions/lib/derive-account-suggestions";
import { createAccountSuggestionService } from "@/features/account-suggestions/services/create-account-suggestion-service";
import type { AnyDb } from "@/shared/db";
import { useMountEffect } from "@/shared/hooks";
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

  const reloadSuggestions = useEffectEvent(() => {
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
  });

  useMountEffect(() => {
    reloadSuggestions();
  });

  useFocusEffect(reloadSuggestions);

  return {
    suggestions,
    hasLoadedSuggestions,
    reloadSuggestions,
  };
}
