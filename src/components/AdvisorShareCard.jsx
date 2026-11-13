import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { advisorQrUrl, advisorShareText, advisorUrl, advisorWhatsappHref } from "../lib/advisorPage";
import { qrCanvas, qrMatrix } from "../lib/propertyQr";
import "./AdvisorShareCard.css";

// «Tu tarjeta digital» (Mi perfil del asesor): el enlace de su página pública (/asesor/<slug>), con botones para copiarlo, mandarlo por
// WhatsApp o compartirlo, y su QR para tarjetas, firma de correo o pantalla. Quien entra a la página puede escribirle, llamarle,
// guardar su contacto y ver sus propiedades; lo que escriba llega a este asesor. Sin `slug` (la base aún no tiene la columna) no hay enlace.
export default function AdvisorShareCard({ advisor }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const qrRef = useRef(null);
  const url = advisorUrl(advisor, window.location.origin);
  const qrUrl = advisorQrUrl(advisor, window.location.origin);

  useEffect(() => {
    if (!qrUrl || !qrRef.current) return;
    const canvas = qrCanvas(qrMatrix(qrUrl), { scale: 8 });
    canvas.className = "advisor-share__qr-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", t("advisorShare.qrLabel"));
    qrRef.current.replaceChildren(canvas);
  }, [qrUrl, t]);

  if (!url) {
    return (
      <section className="card advisor-share" aria-labelledby="advisor-share-title">
        <h2 id="advisor-share-title">{t("advisorShare.title")}</h2>
        <p className="form-hint">{t("advisorShare.unavailable")}</p>
      </section>
    );
  }

  const copy = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("advisorShare.copyManual"), url);
    }
  };

  const share = async () => {
    setError("");
    try {
      await navigator.share({ title: advisor.name, text: advisorShareText(advisor, url), url });
    } catch (err) {
      if (err?.name !== "AbortError") await copy();
    }
  };

  const downloadQr = async () => {
    setError("");
    try {
      const canvas = qrCanvas(qrMatrix(qrUrl), { scale: 24 });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("blob");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `QR_${advisor.slug}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      setError(t("advisorShare.qrError"));
    }
  };

  // Mensaje para mandar su tarjeta a quien sea (sin número destino: WhatsApp deja elegir el contacto).
  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(advisorShareText(advisor, url))}`;

  return (
    <section className="card advisor-share" aria-labelledby="advisor-share-title">
      <h2 id="advisor-share-title">{t("advisorShare.title")}</h2>
      <p className="form-hint">{t("advisorShare.intro")}</p>
      <div className="advisor-share__body">
        <div className="advisor-share__links">
          <div className="form-field">
            <label htmlFor="advisor-share-url">{t("advisorShare.link")}</label>
            <input id="advisor-share-url" type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
          </div>
          <div className="advisor-share__actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
              {copied ? t("advisorShare.copied") : t("advisorShare.copy")}
            </button>
            <a className="btn btn-outline btn-sm" href={whatsappShare} target="_blank" rel="noopener noreferrer">
              {t("advisorShare.whatsapp")}
            </a>
            {typeof navigator !== "undefined" && navigator.share && (
              <button type="button" className="btn btn-outline btn-sm" onClick={share}>
                {t("advisorShare.share")}
              </button>
            )}
            <a className="btn btn-outline btn-sm" href={`/asesor/${advisor.slug}`} target="_blank" rel="noopener noreferrer">
              {t("advisorShare.view")}
            </a>
          </div>
          {advisorWhatsappHref(advisor) == null && <p className="form-hint">{t("advisorShare.noWhatsapp")}</p>}
        </div>
        <div className="advisor-share__qr">
          <div ref={qrRef} />
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadQr}>
            {t("advisorShare.downloadQr")}
          </button>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
