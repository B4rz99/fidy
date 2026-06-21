import * as Haptics from "expo-haptics";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { useState } from "react";
import { TransactionDatePickerDialog } from "@/features/transactions/ui.public";
import { FieldButton, FilterPill } from "@/shared/components";
import { Calendar } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
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
  const accentGreenLight = useThemeColor("accentGreenLight");
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const surfaceRaised = useThemeColor("surfaceRaised");
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
  const currentMonthStartLabel = format(startOfMonth(new Date()), "PP", { locale: dateFnsLocale });
  const currentMonthEndLabel = format(endOfMonth(new Date()), "PP", { locale: dateFnsLocale });
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
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: secondary }]}>{t("search.customRange")}</Text>
      <View style={styles.dateFields}>
        <FieldButton
          active={activePicker === "from"}
          buttonStyle={styles.dateButton}
          icon={Calendar}
          label={t("search.from")}
          onPress={() => setActivePicker("from")}
          placeholder={currentMonthStartLabel}
          placeholderColor={secondary}
          labelStyle={[styles.fieldLabel, { color: primary }]}
          surfaceBackgroundColor={surfaceRaised}
          surfaceRadius={10}
          style={styles.dateField}
          valueStyle={styles.dateButtonValue}
          value={fromDateLabel}
        />
        <FieldButton
          active={activePicker === "to"}
          buttonStyle={styles.dateButton}
          icon={Calendar}
          label={t("search.to")}
          onPress={() => setActivePicker("to")}
          placeholder={currentMonthEndLabel}
          placeholderColor={secondary}
          labelStyle={[styles.fieldLabel, { color: primary }]}
          surfaceBackgroundColor={surfaceRaised}
          surfaceRadius={10}
          style={styles.dateField}
          valueStyle={styles.dateButtonValue}
          value={toDateLabel}
        />
      </View>
      <View style={styles.presets}>
        {DATE_PRESETS.map((preset) => {
          const isActive = activePresetKey === preset.key;
          return (
            <FilterPill
              key={preset.key}
              dimmed={activePresetKey !== null && !isActive}
              label={t(preset.labelKey)}
              labelStyle={styles.presetText}
              onPress={() => handlePreset(preset.key)}
              selected={isActive}
              selectedBackgroundColor={accentGreenLight}
              selectedTextColor={primary}
              surfaceBackgroundColor={surfaceRaised}
              style={[
                styles.presetButton,
                preset.key === "thisWeek" ? styles.weekPreset : null,
                preset.key === "thisMonth" ? styles.monthPreset : null,
                preset.key === "lastMonth" ? styles.lastMonthPreset : null,
              ]}
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

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 16,
  },
  sectionLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  dateFields: {
    flexDirection: "row",
    gap: 12,
  },
  dateField: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  dateButton: {
    minHeight: 42,
    paddingHorizontal: 10,
  },
  dateButtonValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  presets: {
    flexDirection: "row",
    gap: 6,
  },
  presetButton: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 8,
  },
  weekPreset: {
    flex: 1.2,
  },
  monthPreset: {
    flex: 0.9,
  },
  lastMonthPreset: {
    flex: 1.55,
  },
  presetText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
});
