import { I18n } from "i18n-js";
import en from "./locales/en";
import es from "./locales/es";

const i18n = new I18n({ es, en });

i18n.defaultLocale = "es";
i18n.locale = "es";
i18n.enableFallback = true;

export default i18n;
