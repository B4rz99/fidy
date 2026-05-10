import { useCallback, useState } from "react";
import { amountDigitsToAmount } from "../../lib/amount-utils";
import { updateSearchFilters } from "../../store";
import type { SearchDb, SearchUserId } from "./SearchScreen.types";

type SearchAmountFiltersArgs = {
  readonly db: SearchDb;
  readonly userId: SearchUserId;
};

export function useSearchAmountFilters({ db, userId }: SearchAmountFiltersArgs) {
  const [minDigits, setMinDigits] = useState("");
  const [maxDigits, setMaxDigits] = useState("");

  const handleMinChange = useCallback(
    (digits: string) => {
      setMinDigits(digits);
      if (db && userId) {
        updateSearchFilters(db, userId, { amountMin: amountDigitsToAmount(digits) });
      }
    },
    [db, userId]
  );

  const handleMaxChange = useCallback(
    (digits: string) => {
      setMaxDigits(digits);
      if (db && userId) {
        updateSearchFilters(db, userId, { amountMax: amountDigitsToAmount(digits) });
      }
    },
    [db, userId]
  );

  return { handleMaxChange, handleMinChange, maxDigits, minDigits, setMaxDigits, setMinDigits };
}
