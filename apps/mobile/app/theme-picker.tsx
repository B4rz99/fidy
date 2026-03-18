import { useRouter } from "expo-router";
import { type ThemePreference, useSettingsStore } from "@/features/settings/store";
import { Check } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

const OPTIONS: { key: ThemePreference; labelKey: string }[] = [
  { key: "system", labelKey: "settings.themeSystem" },
  { key: "light", labelKey: "settings.themeLight" },
  { key: "dark", labelKey: "settings.themeDark" },
];

export default function ThemePickerSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const current = useSettingsStore((s) => s.themePreference);
  const setTheme = useSettingsStore((s) => s.setThemePreference);
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const handleSelect = (pref: ThemePreference) => {
    setTheme(pref);
    router.back();
  };

  return (
    <View
      className="flex-1 bg-card dark:bg-card-dark"
      style={{ paddingHorizontal: 24, paddingTop: 24 }}
    >
      <Text
        className="font-poppins-semibold text-primary dark:text-primary-dark"
        style={{ fontSize: 16, textAlign: "center", marginBottom: 20 }}
      >
        {t("settings.theme")}
      </Text>
      {OPTIONS.map((option, index) => (
        <Pressable
          key={option.key}
          onPress={() => handleSelect(option.key)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 52,
            paddingHorizontal: 4,
            borderBottomWidth: index < OPTIONS.length - 1 ? StyleSheet.hairlineWidth : 0,
            borderBottomColor: borderColor,
          }}
        >
          <Text
            className="font-poppins-medium text-primary dark:text-primary-dark"
            style={{ fontSize: 15 }}
          >
            {t(option.labelKey)}
          </Text>
          {current === option.key ? <Check size={22} color={accentGreen} /> : null}
        </Pressable>
      ))}
    </View>
  );
}
