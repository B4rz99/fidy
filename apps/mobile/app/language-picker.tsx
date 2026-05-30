import { useRouter } from "expo-router";
import { DialogRouteFrame, Row } from "@/shared/components";
import { Check } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n";

const OPTIONS = [
  { locale: "en", label: "English" },
  { locale: "es", label: "Español" },
] as const;

export default function LanguagePickerSheet() {
  const { t, locale } = useTranslation();
  const { back } = useRouter();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const accentGreen = useThemeColor("accentGreen");

  const handleSelect = (newLocale: string) => {
    setLocale(newLocale);
    back();
  };

  return (
    <DialogRouteFrame>
      <View className="bg-card dark:bg-card-dark" style={{ padding: 24 }}>
        <Text
          className="font-poppins-semibold text-primary dark:text-primary-dark"
          style={{ fontSize: 16, textAlign: "center", marginBottom: 20 }}
        >
          {t("settings.language")}
        </Text>
        {OPTIONS.map((option, index) => {
          const selected = locale.startsWith(option.locale);

          return (
            <Row
              key={option.locale}
              title={option.label}
              onPress={() => handleSelect(option.locale)}
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
