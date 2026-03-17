import type { Locale } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { resolveLanguage } from "./resolve-language";

export const getDateFnsLocale = (locale: string): Locale =>
  resolveLanguage(locale) === "en" ? enUS : es;
