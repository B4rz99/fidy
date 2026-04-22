import { useCallback } from "react";
import { clearSearchFilters } from "../../store";
import type { FilterKey } from "../FilterChipRow";
import type { SearchDb, SearchDebounceRef, SearchUserId } from "./SearchScreen.types";

type SearchClearAllArgs = {
  readonly db: SearchDb;
  readonly debounceRef: SearchDebounceRef;
  readonly setActivePanel: (panel: FilterKey | null) => void;
  readonly setInputText: (text: string) => void;
  readonly setMaxDigits: (digits: string) => void;
  readonly setMinDigits: (digits: string) => void;
  readonly userId: SearchUserId;
};

export function useSearchClearAll(args: SearchClearAllArgs) {
  return useCallback(() => {
    if (args.debounceRef.current) clearTimeout(args.debounceRef.current);
    args.setInputText("");
    args.setMinDigits("");
    args.setMaxDigits("");
    args.setActivePanel(null);
    if (args.db && args.userId) clearSearchFilters(args.db, args.userId);
  }, [args]);
}
