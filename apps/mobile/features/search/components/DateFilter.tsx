import * as Haptics from "expo-haptics";
import { Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { DATE_PRESETS, getDatePresetRange } from "../lib/date-presets";

type DateFilterProps = {
  dateFrom: string | null;
  dateTo: string | null;
  onChangeRange: (from: string | null, to: string | null) => void;
};

export const DateFilter = ({ dateFrom, dateTo, onChangeRange }: DateFilterProps) => {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");

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

  return (
    <View className="p-4 gap-3">
      <View className="flex-row flex-wrap gap-2">
        {DATE_PRESETS.map((preset) => {
          const isActive = activePresetKey === preset.key;
          return (
            <Pressable
              key={preset.key}
              className="h-8 rounded-full px-4 items-center justify-center"
              style={{
                backgroundColor: isActive ? accentGreen : peachLight,
              }}
              onPress={() => handlePreset(preset.key)}
            >
              <Text
                className="font-poppins-medium text-caption"
                style={{ color: isActive ? "#FFFFFF" : primary }}
              >
                {t(preset.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
        {t("search.customRange")}
      </Text>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark mb-1">
            {t("search.from")}
          </Text>
          <TextInput
            className="h-10 rounded-lg px-3 font-poppins-medium text-body"
            style={{ backgroundColor: peachLight, color: primary }}
            value={dateFrom ?? ""}
            onChangeText={(text) => onChangeRange(text.length > 0 ? text : null, dateTo)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={secondary}
            autoCapitalize="none"
          />
        </View>
        <View className="flex-1">
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark mb-1">
            {t("search.to")}
          </Text>
          <TextInput
            className="h-10 rounded-lg px-3 font-poppins-medium text-body"
            style={{ backgroundColor: peachLight, color: primary }}
            value={dateTo ?? ""}
            onChangeText={(text) => onChangeRange(dateFrom, text.length > 0 ? text : null)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={secondary}
            autoCapitalize="none"
          />
        </View>
      </View>
    </View>
  );
};
