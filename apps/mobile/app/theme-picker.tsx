import { useRouter } from "expo-router";
import { type ThemePreference, useSettingsStore } from "@/features/settings/hooks.public";
import { DialogRouteFrame, Row } from "@/shared/components";
import { Check } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
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

  const handleSelect = (pref: ThemePreference) => {
    setTheme(pref);
    router.back();
  };

  return (
    <DialogRouteFrame>
      <View className="bg-card dark:bg-card-dark" style={{ padding: 24 }}>
        <Text
          className="font-poppins-semibold text-primary dark:text-primary-dark"
          style={{ fontSize: 16, textAlign: "center", marginBottom: 20 }}
        >
          {t("settings.theme")}
        </Text>
        {OPTIONS.map((option, index) => {
          const selected = current === option.key;

          return (
            <Row
              key={option.key}
              title={t(option.labelKey)}
              onPress={() => handleSelect(option.key)}
              trailing={selected ? <Check size={22} color={accentGreen} /> : null}
              accessibilityState={{ selected }}
              isLast={index === OPTIONS.length - 1}
              className="px-1"
              titleClassName="text-[15px]"
            />
          );
        })}
      </View>
    </DialogRouteFrame>
  );
}
