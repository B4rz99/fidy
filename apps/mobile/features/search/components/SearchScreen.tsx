import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth";
import { CATEGORY_MAP, makeDateLabel, type StoredTransaction } from "@/features/transactions";
import { ScreenLayout, TAB_BAR_CLEARANCE, TransactionRow } from "@/shared/components";
import { Ellipsis } from "@/shared/components/icons";
import { FlatList, InteractionManager, Text, TextInput, View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatSignedMoney, toIsoDate } from "@/shared/lib";
import { amountDigitsToAmount } from "../lib/amount-utils";
import { hasActiveFilters } from "../lib/filters";
import type { SearchFilters } from "../lib/types";
import {
  clearSearchFilters,
  executeSearch,
  loadNextSearchPage,
  updateSearchFilters,
  updateSearchQuery,
  useSearchStore,
} from "../store";
import { AmountFilter } from "./AmountFilter";
import { CategoryFilter } from "./CategoryFilter";
import { DateFilter } from "./DateFilter";
import { FilterChipRow, type FilterKey } from "./FilterChipRow";
import { ResultsSummary } from "./ResultsSummary";
import { SearchEmptyState } from "./SearchEmptyState";
import { TypeFilter } from "./TypeFilter";

const DEBOUNCE_MS = 300;

const SearchTransactionItem = memo(function SearchTransactionItem({
  tx,
  showDateHeader,
}: {
  tx: StoredTransaction;
  showDateHeader: boolean;
}) {
  const { t, locale } = useTranslation();
  const category = CATEGORY_MAP[tx.categoryId];
  return (
    <View>
      {showDateHeader && (
        <View className="px-4 pt-4 pb-1">
          <Text className="font-poppins-semibold text-caption text-secondary dark:text-secondary-dark">
            {makeDateLabel(
              tx.date,
              t("dates.today"),
              t("dates.yesterday"),
              getDateFnsLocale(locale)
            )}
          </Text>
        </View>
      )}
      <View className="px-4">
        <TransactionRow
          icon={category?.icon ?? Ellipsis}
          name={tx.description || t("common.unknown")}
          amount={formatSignedMoney(tx.amount, tx.type)}
          category={category ? getCategoryLabel(category, locale) : t("common.other")}
          isPositive={tx.type === "income"}
        />
      </View>
    </View>
  );
});

export const SearchScreen = () => {
  const { back } = useRouter();
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const peachLight = useThemeColor("peachLight");
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const db = userId ? getDb(userId) : null;

  const filters = useSearchStore((s) => s.filters);
  const results = useSearchStore((s) => s.results);
  const hasMore = useSearchStore((s) => s.hasMore);
  const summary = useSearchStore((s) => s.summary);
  const reset = useSearchStore((s) => s.reset);

  const [ready, setReady] = useState(false);
  const [inputText, setInputText] = useState("");
  const [activePanel, setActivePanel] = useState<FilterKey | null>(null);
  const [minDigits, setMinDigits] = useState("");
  const [maxDigits, setMaxDigits] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useMountEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setReady(true);
      if (db && userId) {
        executeSearch(db, userId);
      }
      inputRef.current?.focus();
    });
    return () => {
      handle.cancel();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      reset();
    };
  });

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!db || !userId) return;
        updateSearchQuery(db, userId, text);
      }, DEBOUNCE_MS);
    },
    [db, userId]
  );

  const handleTogglePanel = useCallback((key: FilterKey) => {
    setActivePanel((prev) => (prev === key ? null : key));
  }, []);

  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      const current = useSearchStore.getState().filters.categoryIds;
      const next = current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId];
      if (!db || !userId) return;
      updateSearchFilters(db, userId, { categoryIds: next });
    },
    [db, userId]
  );

  const handleClearAll = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputText("");
    setMinDigits("");
    setMaxDigits("");
    setActivePanel(null);
    if (!db || !userId) return;
    clearSearchFilters(db, userId);
  }, [db, userId]);

  const handleMinChange = useCallback(
    (digits: string) => {
      setMinDigits(digits);
      if (!db || !userId) return;
      updateSearchFilters(db, userId, { amountMin: amountDigitsToAmount(digits) });
    },
    [db, userId]
  );

  const handleMaxChange = useCallback(
    (digits: string) => {
      setMaxDigits(digits);
      if (!db || !userId) return;
      updateSearchFilters(db, userId, { amountMax: amountDigitsToAmount(digits) });
    },
    [db, userId]
  );

  const handleDateRangeChange = useCallback(
    (from: string | null, to: string | null) => {
      if (!db || !userId) return;
      updateSearchFilters(db, userId, { dateFrom: from, dateTo: to });
    },
    [db, userId]
  );

  const handleTypeChange = useCallback(
    (type: SearchFilters["type"]) => {
      if (!db || !userId) return;
      updateSearchFilters(db, userId, { type });
    },
    [db, userId]
  );

  const handleEndReached = useCallback(() => {
    if (!db || !userId || !hasMore) return;
    loadNextSearchPage(db, userId);
  }, [db, hasMore, userId]);

  const dateBreaks = useMemo(() => {
    const breaks = new Set<string>();
    let lastDateKey: string | null = null;
    results.forEach((tx) => {
      const dateKey = toIsoDate(tx.date);
      if (dateKey !== lastDateKey) {
        breaks.add(tx.id);
        lastDateKey = dateKey;
      }
    });
    return breaks;
  }, [results]);

  const renderItem = useCallback(
    ({ item }: { item: StoredTransaction }) => (
      <SearchTransactionItem tx={item} showDateHeader={dateBreaks.has(item.id)} />
    ),
    [dateBreaks]
  );

  const keyExtractor = useCallback((item: StoredTransaction) => item.id, []);

  const showSummary = summary && hasActiveFilters(filters);

  const filterPanel = useMemo(() => {
    if (activePanel === "category") {
      return <CategoryFilter selectedIds={filters.categoryIds} onToggle={handleCategoryToggle} />;
    }
    if (activePanel === "dateRange") {
      return (
        <DateFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChangeRange={handleDateRangeChange}
        />
      );
    }
    if (activePanel === "amount") {
      return (
        <AmountFilter
          minDigits={minDigits}
          maxDigits={maxDigits}
          onChangeMin={handleMinChange}
          onChangeMax={handleMaxChange}
        />
      );
    }
    if (activePanel === "type") {
      return (
        <View className="p-4 items-center">
          <TypeFilter value={filters.type} onChange={handleTypeChange} />
        </View>
      );
    }
    return null;
  }, [
    activePanel,
    filters.categoryIds,
    filters.dateFrom,
    filters.dateTo,
    filters.type,
    minDigits,
    maxDigits,
    handleCategoryToggle,
    handleDateRangeChange,
    handleMinChange,
    handleMaxChange,
    handleTypeChange,
  ]);

  return (
    <ScreenLayout title={t("search.title")} variant="sub" onBack={back}>
      {!ready ? null : (
        <>
          <View className="px-4 pb-2">
            <TextInput
              ref={inputRef}
              className="h-10 rounded-lg px-3 font-poppins-medium text-body"
              style={{ backgroundColor: peachLight, color: primary }}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder={t("search.placeholder")}
              placeholderTextColor={secondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListHeaderComponent={
              <>
                <FilterChipRow
                  filters={filters}
                  activePanel={activePanel}
                  onTogglePanel={handleTogglePanel}
                  onClearAll={handleClearAll}
                />
                {filterPanel && (
                  <View
                    className="mx-4 mb-3 rounded-xl bg-card dark:bg-card-dark"
                    style={{ overflow: "hidden" }}
                  >
                    {filterPanel}
                  </View>
                )}
                {showSummary && <ResultsSummary summary={summary} />}
              </>
            }
            ListEmptyComponent={
              hasActiveFilters(filters) ? (
                <SearchEmptyState onClearFilters={handleClearAll} />
              ) : undefined
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
          />
        </>
      )}
    </ScreenLayout>
  );
};
