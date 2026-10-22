import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadQrPng, downloadQrSignPdf, qrCanvas, qrMatrix, qrTargetUrl, signHeading } from "../lib/propertyQr";
import "./PropertyProspectsModal.css";
import "./PropertyQrModal.css";

// "QR" de una propiedad (Propiedades del admin): el código que lleva a su ficha
// pública, listo para letreros y volantes. Se baja como letrero en PDF (carta,
// sobre la hoja membretada) o solo como imagen PNG para ponerlo donde haga falta.
export default function PropertyQrModal({ property, onClose }) {
  const { t } = useTranslation();
  const origin = window.location.origin;
  const url = useMemo(() => qrTargetUrl(property, origin), [property, origin]);
  const preview = useMemo(() => qrCanvas(qrMatrix(url), { scale: 8 }).toDataURL("image/png"), [url]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (kind, task) => {
    setBusy(kind);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(err?.message || t("propertyQr.error"));
    } finally {
      setBusy("");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles: el enlace sigue a la vista para copiarlo a mano.
    }
  };

  const notAvailable = property.status !== "disponible" || property.active === false;

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("propertyQr.title")}>
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card property-qr">
        <div className="match-modal__head">
          <h2>{t("propertyQr.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="form-hint">
          <strong>{property.title}</strong> — {t("propertyQr.hint")}
        </p>

        {notAvailable && (
          <p className="property-qr__warn" role="status">
            {t("propertyQr.notAvailable", { heading: signHeading(property) })}
          </p>
        )}

        <div className="property-qr__preview">
          <img src={preview} alt={t("propertyQr.alt", { title: property.title })} width="240" height="240" />
        </div>

        <div className="property-qr__actions">
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run("pdf", () => downloadQrSignPdf(property, { origin }))}>
            {busy === "pdf" ? <span className="spinner" /> : null}
            {t("propertyQr.downloadSign")}
          </button>
          <button type="button" className="btn btn-outline" disabled={Boolean(busy)} onClick={() => run("png", () => downloadQrPng(property, origin))}>
            {busy === "png" ? <span className="spinner" /> : null}
            {t("propertyQr.downloadPng")}
          </button>
          <button type="button" className="btn btn-outline" onClick={copy}>
            {copied ? t("propertyQr.copied") : t("propertyQr.copyLink")}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <p className="form-hint property-qr__url">{url}</p>
        <p className="form-hint">{t("propertyQr.tips")}</p>
      </div>
    </div>
  );
}
