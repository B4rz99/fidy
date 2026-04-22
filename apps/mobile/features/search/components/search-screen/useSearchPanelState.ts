import { useCallback, useState } from "react";
import type { FilterKey } from "../FilterChipRow";

export function useSearchPanelState() {
  const [activePanel, setActivePanel] = useState<FilterKey | null>(null);

  const handleTogglePanel = useCallback((key: FilterKey) => {
    setActivePanel((prev) => (prev === key ? null : key));
  }, []);

  return { activePanel, handleTogglePanel, setActivePanel };
}
