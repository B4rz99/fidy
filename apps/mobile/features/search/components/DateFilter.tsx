import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { useState } from "react";
import { TransactionDatePickerDialog } from "@/features/transactions/ui.public";
import { FieldButton, FilterPill } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { parseOptionalIsoDate, toIsoDate } from "@/shared/lib";
import { DATE_PRESETS, getDatePresetRange } from "../lib/date-presets";

type DateFilterProps = {
  dateFrom: string | null;
  dateTo: string | null;
  onChangeRange: (from: string | null, to: string | null) => void;
};

export const DateFilter = ({ dateFrom, dateTo, onChangeRange }: DateFilterProps) => {
  const { t, locale } = useTranslation();
  const [activePicker, setActivePicker] = useState<"from" | "to" | null>(null);

  const activePresetKey =
    DATE_PRESETS.find((p) => {
      const range = p.getRange(new Date());
      return range.from === dateFrom && range.to === dateTo;
    })?.key ?? null;

  const handlePreset = (key: string) => {
    void Haptics.selectionAsync();
    if (activePresetKey === key) {
      onChangeRange(null, null);
      return;
    }
    const range = getDatePresetRange(key, new Date());
    if (range) {
      onChangeRange(range.from, range.to);
    }
  };

  const fromDate = parseOptionalIsoDate(dateFrom) ?? new Date();
  const toDate = parseOptionalIsoDate(dateTo) ?? parseOptionalIsoDate(dateFrom) ?? new Date();
  const dateFnsLocale = getDateFnsLocale(locale);
  const fromDateLabel = dateFrom ? format(fromDate, "PP", { locale: dateFnsLocale }) : "";
  const toDateLabel = dateTo ? format(toDate, "PP", { locale: dateFnsLocale }) : "";

  const handleDateChange = (target: "from" | "to", date: Date) => {
    const next = toIsoDate(date);
    if (target === "from") {
      onChangeRange(next, dateTo);
      return;
    }
    onChangeRange(dateFrom, next);
  };

  return (
    <View className="gap-3 p-4">
      <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
        {t("search.customRange")}
      </Text>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <FieldButton
            label={t("search.from")}
            value={fromDateLabel}
            placeholder={t("search.chooseDate")}
            onPress={() => setActivePicker("from")}
            active={activePicker === "from"}
          />
        </View>
        <View className="flex-1">
          <FieldButton
            label={t("search.to")}
            value={toDateLabel}
            placeholder={t("search.chooseDate")}
            onPress={() => setActivePicker("to")}
            active={activePicker === "to"}
          />
        </View>
      </View>
      <View className="flex-row gap-2">
        {DATE_PRESETS.map((preset) => {
          const isActive = activePresetKey === preset.key;
          return (
            <FilterPill
              key={preset.key}
              label={t(preset.labelKey)}
              selected={isActive}
              selectedColor="#2F7D32"
              style={
                preset.key === "lastMonth"
                  ? { flex: 1.35, minHeight: 32, paddingHorizontal: 8 }
                  : { flex: 1, minHeight: 32, paddingHorizontal: 8 }
              }
              onPress={() => handlePreset(preset.key)}
              labelClassName="text-[12px]"
            />
          );
        })}
      </View>
      <TransactionDatePickerDialog
        date={activePicker === "to" ? toDate : fromDate}
        visible={activePicker !== null}
        onChange={(date) => {
          if (activePicker) handleDateChange(activePicker, date);
        }}
        onClose={() => setActivePicker(null)}
      />
    </View>
  );
};
