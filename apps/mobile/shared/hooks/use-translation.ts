import { useLocaleStore } from "@/shared/i18n/store";

export const useTranslation = () => {
  const locale = useLocaleStore((s) => s.locale);
  const t = useLocaleStore((s) => s.t);
  return { t, locale } as const;
};
