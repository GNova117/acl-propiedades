import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Copia el enlace de la visita para pegarlo en cualquier chat. Si el navegador
// no deja escribir en el portapapeles, muestra el enlace para copiarlo a mano.
export default function CopyVisitLinkButton({ link, className = "btn btn-outline btn-sm" }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt(t("visitLink.copyFallback"), link);
    }
  };

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? t("visitLink.copied") : t("visitLink.copy")}
    </button>
  );
}
