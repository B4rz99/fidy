import type { ReactNode, RefObject } from "react";
import type { StoredTransaction } from "@/features/transactions";
import type { TextInput } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { SearchFilters, SearchSummary } from "../../lib/types";
import type { FilterKey } from "../FilterChipRow";

export type SearchDb = AnyDb | null;
export type SearchInputRef = RefObject<TextInput | null>;
export type SearchDebounceRef = { current: ReturnType<typeof setTimeout> | null };
export type SearchUserId = UserId | null | undefined;

export type SearchScreenViewModel = {
  readonly activePanel: FilterKey | null;
  readonly filterPanel: ReactNode;
  readonly filters: SearchFilters;
  readonly handleClearAll: () => void;
  readonly handleEndReached: () => void;
  readonly handleTextChange: (text: string) => void;
  readonly handleTogglePanel: (key: FilterKey) => void;
  readonly inputRef: SearchInputRef;
  readonly inputText: string;
  readonly onBack: () => void;
  readonly peachLight: string;
  readonly primary: string;
  readonly ready: boolean;
  readonly results: readonly StoredTransaction[];
  readonly secondary: string;
  readonly showSummary: boolean;
  readonly summary: SearchSummary | null;
};
