import { View } from "@/shared/components/rn";
import type { SearchFilters } from "../../lib/types";
import { TypeFilter } from "../TypeFilter";

type SearchTypePanelProps = {
  readonly handleTypeChange: (type: SearchFilters["type"]) => void;
  readonly type: SearchFilters["type"];
};

export function SearchTypePanel({ handleTypeChange, type }: SearchTypePanelProps) {
  return (
    <View className="p-4 items-center">
      <TypeFilter value={type} onChange={handleTypeChange} />
    </View>
  );
}
