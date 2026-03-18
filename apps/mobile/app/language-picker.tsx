import { useRouter } from "expo-router";
import { Check } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n";

const OPTIONS = [
  { locale: "en", label: "English" },
  { locale: "es", label: "Español" },
] as const;

export default function LanguagePickerSheet() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const handleSelect = (newLocale: string) => {
    setLocale(newLocale);
    router.back();
  };

  return (
    <View className="flex-1 bg-card dark:bg-card-dark" style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <Text
        className="font-poppins-semibold text-primary dark:text-primary-dark"
        style={{ fontSize: 16, textAlign: "center", marginBottom: 20 }}
      >
        {t("settings.language")}
      </Text>
      {OPTIONS.map((option, index) => (
        <Pressable
          key={option.locale}
          onPress={() => handleSelect(option.locale)}
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
            {option.label}
          </Text>
          {locale.startsWith(option.locale) ? (
            <Check size={22} color={accentGreen} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
