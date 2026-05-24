import * as Haptics from "expo-haptics";
import { useState } from "react";
import { TransactionDatePickerSheet } from "@/features/transactions/display.public";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { parseOptionalIsoDate, toIsoDate } from "@/shared/lib";
import { DATE_PRESETS, getDatePresetRange } from "../lib/date-presets";

type DateFilterProps = {
  dateFrom: string | null;
  dateTo: string | null;
  onChangeRange: (from: string | null, to: string | null) => void;
};

export const DateFilter = ({ dateFrom, dateTo, onChangeRange }: DateFilterProps) => {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
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
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark mb-1">
            {t("search.from")}
          </Text>
          <Pressable
            className="h-10 justify-center rounded-lg px-3"
            style={{ backgroundColor: peachLight }}
            onPress={() => setActivePicker("from")}
            accessibilityRole="button"
          >
            <Text className="font-poppins-medium text-body" style={{ color: primary }}>
              {dateFrom ?? t("search.chooseDate")}
            </Text>
          </Pressable>
        </View>
        <View className="flex-1">
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark mb-1">
            {t("search.to")}
          </Text>
          <Pressable
            className="h-10 justify-center rounded-lg px-3"
            style={{ backgroundColor: peachLight }}
            onPress={() => setActivePicker("to")}
            accessibilityRole="button"
          >
            <Text className="font-poppins-medium text-body" style={{ color: primary }}>
              {dateTo ?? t("search.chooseDate")}
            </Text>
          </Pressable>
        </View>
      </View>
      <View className="flex-row gap-2">
        {DATE_PRESETS.map((preset) => {
          const isActive = activePresetKey === preset.key;
          return (
            <Pressable
              key={preset.key}
              className="h-8 items-center justify-center rounded-full px-2"
              style={[
                {
                  backgroundColor: isActive ? accentGreen : peachLight,
                },
                preset.key === "lastMonth" ? { flex: 1.35 } : { flex: 1 },
              ]}
              onPress={() => handlePreset(preset.key)}
            >
              <Text
                className="text-center font-poppins-medium text-[11px]"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={{ color: isActive ? "#FFFFFF" : primary }}
              >
                {t(preset.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TransactionDatePickerSheet
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
