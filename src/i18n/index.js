import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import es from "./locales/es.json";
import en from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: "es",
    supportedLngs: ["es", "en"],
    interpolation: { escapeValue: false },
    // Re-renderiza los componentes cuando se agregan traducciones en caliente:
    // los nombres de tipos de propiedad editables se inyectan así (ver
    // src/lib/propertyTypeLabels.js).
    react: { bindI18nStore: "added" },
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "acl_language",
    },
  });

export default i18n;
