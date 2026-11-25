import { useTranslation } from "react-i18next";

// «Este enlace vence el …» para las páginas públicas que se abren con un enlace secreto (selección, firma, documentos, registro,
// informe del vendedor): quien lo recibe sabe hasta cuándo sirve. Sin fecha no pinta nada.
export function formatLinkDate(value, language) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(language === "en" ? "en-US" : "es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export default function LinkExpiry({ date, className = "form-hint" }) {
  const { t, i18n } = useTranslation();
  const formatted = formatLinkDate(date, i18n.language);
  if (!formatted) return null;
  return <p className={className}>{t("tokenLink.validUntil", { date: formatted })}</p>;
}
