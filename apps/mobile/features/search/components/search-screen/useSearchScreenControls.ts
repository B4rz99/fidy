import { useSearchAmountFilters } from "./useSearchAmountFilters";
import { useSearchClearAll } from "./useSearchClearAll";
import { useSearchInitialization } from "./useSearchInitialization";
import { useSearchInputController } from "./useSearchInputController";
import { useSearchPanelState } from "./useSearchPanelState";
import type { useSearchScreenBase } from "./useSearchScreenBase";
import { useSearchStoreActions } from "./useSearchStoreActions";

export function useSearchScreenControls(base: ReturnType<typeof useSearchScreenBase>) {
  const { debounceRef, inputRef, ready } = useSearchInitialization(base);
  const input = useSearchInputController({ db: base.db, debounceRef, userId: base.userId });
  const panel = useSearchPanelState();
  const amount = useSearchAmountFilters({ db: base.db, userId: base.userId });
  const actions = useSearchStoreActions({
    db: base.db,
    hasMore: base.hasMore,
    userId: base.userId,
  });
  const handleClearAll = useSearchClearAll({
    db: base.db,
    debounceRef,
    setActivePanel: panel.setActivePanel,
    setInputText: input.setInputText,
    setMaxDigits: amount.setMaxDigits,
    setMinDigits: amount.setMinDigits,
    userId: base.userId,
  });

  return { actions, amount, handleClearAll, input, inputRef, panel, ready };
}
