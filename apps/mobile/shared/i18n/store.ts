import { create } from "zustand";
import i18n from "./i18n";
import { resolveLanguage } from "./resolve-language";

type LocaleState = {
  readonly locale: string;
};

type LocaleActions = {
  readonly initLocale: (deviceLocale: string) => void;
  readonly setLocale: (locale: string) => void;
  readonly t: (scope: string, options?: Record<string, unknown>) => string;
};

export const useLocaleStore = create<LocaleState & LocaleActions>((set) => ({
  locale: i18n.locale,

  initLocale: (deviceLocale: string) => {
    const resolved = resolveLanguage(deviceLocale);
    i18n.locale = resolved;
    set({ locale: resolved });
  },

  setLocale: (locale: string) => {
    i18n.locale = locale;
    set({ locale });
  },

  t: i18n.t.bind(i18n),
}));
