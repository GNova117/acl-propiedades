import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import es from "./locales/es.json";

// Solo el español viaja en el paquete inicial. El inglés (en.json) es un fragmento aparte que se baja
// únicamente cuando el idioma detectado o elegido es inglés (?lang=en, localStorage `acl_language` o el
// botón de LanguageToggle). Para no mostrar un destello de español, src/main.jsx espera `i18nReady`
// antes de montar la app, y el botón usa `changeLanguage` (abajo), que baja el inglés ANTES de cambiar.

const isEnglish = (lng) => String(lng || "").toLowerCase().startsWith("en");

// Copia de los textos de fábrica en inglés tomada ANTES de inyectarlos en i18next, que guarda por
// referencia los objetos que recibe y addResourceBundle los muta (ver src/lib/propertyTypeLabels.js).
let englishFactory = null;
let englishPromise = null;
const englishListeners = new Set();

export const getEnglishFactory = () => englishFactory;

// Avisa cuando el inglés ya está dentro de i18next (propertyTypeLabels reaplica los nombres editables).
export function onEnglishLoaded(listener) {
  englishListeners.add(listener);
  return () => englishListeners.delete(listener);
}

export function loadEnglish() {
  if (!englishPromise) {
    englishPromise = import("./locales/en.json")
      .then(({ default: en }) => {
        englishFactory = { propertyType: { ...en.propertyType } };
        i18n.addResourceBundle("en", "translation", en, true, true);
        englishListeners.forEach((listener) => listener());
      })
      .catch((err) => {
        // Sin red / fragmento viejo: se permite reintentar en el siguiente intento.
        englishPromise = null;
        throw err;
      });
  }
  return englishPromise;
}

// Cambia de idioma bajando primero el bundle si hace falta; si la descarga falla se queda en el idioma actual.
export async function changeLanguage(lng) {
  if (isEnglish(lng)) {
    try {
      await loadEnglish();
    } catch {
      return;
    }
  }
  await i18n.changeLanguage(lng);
}

export const i18nReady = i18n
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
    // src/lib/propertyTypeLabels.js) y también el inglés cuando termina de bajar.
    react: { bindI18nStore: "added" },
    detection: {
      // ?lang=en (enlaces hreflang / compartidos) manda sobre lo guardado; sin él, la elección guardada o español.
      order: ["querystring", "localStorage"],
      lookupQuerystring: "lang",
      caches: ["localStorage"],
      lookupLocalStorage: "acl_language",
    },
  })
  .then(async () => {
    if (!isEnglish(i18n.language)) return;
    try {
      await loadEnglish();
      // `resolvedLanguage` (lo lee Seo.jsx para <html lang>, canonical y og:locale) se calculó al iniciar, cuando todavía no
      // había textos en inglés y resolvió a «es»: se vuelve a resolver ahora que el bundle ya está.
      await i18n.changeLanguage(i18n.language);
    } catch {
      // Sin red: el sitio abre en español.
    }
  });

export default i18n;
