import { useCallback, useState } from "react";
import { updateSearchQuery } from "../../store";
import type { SearchDb, SearchDebounceRef, SearchUserId } from "./SearchScreen.types";

type SearchInputControllerArgs = {
  readonly db: SearchDb;
  readonly debounceRef: SearchDebounceRef;
  readonly userId: SearchUserId;
};

const DEBOUNCE_MS = 300;

export function useSearchInputController(args: SearchInputControllerArgs) {
  const [inputText, setInputText] = useState("");

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (args.debounceRef.current) clearTimeout(args.debounceRef.current);
      args.debounceRef.current = setTimeout(() => {
        if (args.db && args.userId) updateSearchQuery(args.db, args.userId, text);
      }, DEBOUNCE_MS);
    },
    [args]
  );

  return { handleTextChange, inputText, setInputText };
}
