import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./ShareButton.css";

// Con Web Share API (la mayoría de navegadores móviles y algunos de
// escritorio) un solo botón abre la hoja nativa de compartir del sistema
// — no hace falta armar un menú propio. Donde no existe (la mayoría de
// escritorio hoy), se usa un <details>/<summary> como menú desplegable
// sin JS extra para abrir/cerrar, mismo patrón que el FAQ de esta misma
// página.
// `text`: cuerpo enriquecido opcional (ya debe terminar con la URL propia,
// como en una publicación de portal inmobiliario) — si no se manda, se
// arma uno genérico con solo título y URL, para no romper otros usos
// futuros de este botón que no tengan un texto propio que armar.
export default function ShareButton({ title, text, url }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shareText = text || `${title} — ${url}`;

  const handleNativeShare = async () => {
    try {
      // Se manda todo dentro de `text` (ya incluye la URL al final) en vez
      // de separar `url` — varias apps del share sheet nativo pegan texto
      // y url por su cuenta, y eso duplicaría el link.
      await navigator.share({ title, text: shareText });
    } catch {
      // El usuario cerró la hoja de compartir sin elegir nada — no es un error.
    }
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Último recurso si el portapapeles no está disponible — algunos
      // navegadores/contextos embebidos tampoco soportan window.prompt,
      // así que esto también va en su propio try/catch.
      try {
        window.prompt(t("detail.copyLinkManual"), shareText);
      } catch {
        // No hay más alternativas sin backend — se queda callado en vez
        // de tronar con una excepción sin capturar.
      }
    }
  };

  if (canNativeShare) {
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={handleNativeShare}>
        {t("detail.share")}
      </button>
    );
  }

  return (
    <details className="share-button">
      <summary className="btn btn-outline btn-sm">{t("detail.share")}</summary>
      <div className="share-button__menu">
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
          Facebook
        </a>
        <button type="button" onClick={handleCopy}>
          {copied ? t("detail.linkCopied") : t("detail.copyLink")}
        </button>
      </div>
    </details>
  );
}
