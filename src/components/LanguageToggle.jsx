import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language?.startsWith("en");

  const toggle = () => {
    i18n.changeLanguage(isEnglish ? "es" : "en");
  };

  return (
    <button type="button" className="icon-toggle lang-toggle" onClick={toggle} aria-label={`${isEnglish ? "EN" : "ES"} · ${t("a11y.switchLanguage")}`} title="ES / EN">
      {isEnglish ? "EN" : "ES"}
    </button>
  );
}
