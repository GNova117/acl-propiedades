import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import es from "./locales/es.json";

// Solo el español viaja en el paquete inicial; el inglés (otros ~100 kB comprimidos) se baja cuando se pide: con ?lang=en, con el idioma
// guardado o al tocar el botón de idioma. `i18nReady` se resuelve cuando el idioma activo ya está cargado (main.jsx espera antes de
// pintar, para que el inglés no salga un instante en español).
const LOADERS = { en: () => import("./locales/en.json") };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
    },
    fallbackLng: "es",
    supportedLngs: ["es", "en"],
    interpolation: { escapeValue: false },
    // Re-renderiza los componentes cuando se agregan traducciones en caliente:
    // los nombres de tipos de propiedad editables se inyectan así (ver
    // src/lib/propertyTypeLabels.js).
    react: { bindI18nStore: "added" },
    detection: {
      // ?lang=en (enlaces hreflang / compartidos) manda sobre lo guardado; sin él, la elección guardada o español.
      order: ["querystring", "localStorage"],
      lookupQuerystring: "lang",
      caches: ["localStorage"],
      lookupLocalStorage: "acl_language",
    },
  });

const pending = {};

// Baja (una sola vez) el idioma pedido y lo agrega. `overwrite = false`: lo que ya se inyectó en caliente (los nombres de tipos de
// propiedad que edita el admin) no se pisa con los de fábrica.
export function ensureLanguage(lng) {
  const code = String(lng || "").slice(0, 2);
  const load = LOADERS[code];
  if (!load || i18n.hasResourceBundle(code, "translation") && i18n.getResource(code, "translation", "nav")) return Promise.resolve();
  pending[code] ||= load()
    .then(async (module) => {
      i18n.addResourceBundle(code, "translation", module.default, true, false);
      // Si ese es el idioma activo, se vuelve a aplicar: `resolvedLanguage` (y con él <html lang>, el SEO y los plurales) se calculó cuando
      // todavía no había textos en ese idioma y seguía en español.
      if (i18n.language?.startsWith(code)) await i18n.changeLanguage(i18n.language);
    })
    .catch((err) => {
      console.error("No se pudo cargar el idioma", code, err);
    })
    .finally(() => {
      delete pending[code];
    });
  return pending[code];
}

export const i18nReady = ensureLanguage(i18n.language);

export default i18n;
