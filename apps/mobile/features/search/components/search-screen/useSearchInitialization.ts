import { useRef, useState } from "react";
import { InteractionManager, type TextInput } from "@/shared/components/rn";
import { useMountEffect } from "@/shared/hooks";
import type { SearchFilters } from "../../lib/types";
import { executeSearch, updateSearchFilters } from "../../store";
import type {
  SearchDb,
  SearchDebounceRef,
  SearchInputRef,
  SearchUserId,
} from "./SearchScreen.types";

type SearchInitializationArgs = {
  readonly db: SearchDb;
  readonly initialRouteFilters: Partial<SearchFilters>;
  readonly reset: () => void;
  readonly shouldAutoFocusInput: boolean;
  readonly userId: SearchUserId;
};

function bootstrapSearch(
  args: SearchInitializationArgs,
  inputRef: SearchInputRef,
  setReady: (ready: boolean) => void
) {
  setReady(true);
  if (args.db && args.userId) {
    if (args.initialRouteFilters.categoryIds != null) {
      updateSearchFilters(args.db, args.userId, args.initialRouteFilters);
    } else {
      executeSearch(args.db, args.userId);
    }
  }
  if (args.shouldAutoFocusInput) inputRef.current?.focus();
}

export function useSearchInitialization(args: SearchInitializationArgs) {
  const [ready, setReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useMountEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() =>
      bootstrapSearch(args, inputRef as SearchInputRef, setReady)
    );

    return () => {
      handle.cancel();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      args.reset();
    };
  });

  return {
    debounceRef: debounceRef as SearchDebounceRef,
    inputRef: inputRef as SearchInputRef,
    ready,
  };
}
