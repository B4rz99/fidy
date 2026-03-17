export const resolveLanguage = (locale: string): "es" | "en" => {
  const lang = locale.split("-")[0]?.toLowerCase() ?? "es";
  return lang === "en" ? "en" : "es";
};
