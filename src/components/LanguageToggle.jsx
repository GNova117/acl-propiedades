import { useTranslation } from "react-i18next";
import { ensureLanguage } from "../i18n";

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language?.startsWith("en");

  // Se baja el idioma antes de cambiarlo (el inglés no viene en el paquete inicial): así no hay un instante en español.
  const toggle = async () => {
    const next = isEnglish ? "es" : "en";
    await ensureLanguage(next);
    i18n.changeLanguage(next);
  };

  return (
    <button type="button" className="icon-toggle lang-toggle" onClick={toggle} aria-label={`${isEnglish ? "EN" : "ES"} · ${t("a11y.switchLanguage")}`} title="ES / EN">
      {isEnglish ? "EN" : "ES"}
    </button>
  );
}
