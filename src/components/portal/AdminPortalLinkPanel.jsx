import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { portalLinkPath } from "../../lib/clientPortal";

// Botón "Generar enlace de documentos" de la ficha del cliente: crea o
// regenera el token de /documentos/<token> y lo comparte por WhatsApp — el
// asesor es quien decide a quién se lo manda, el cliente nunca se
// autoregistra (ver supabase/schema.sql, bloque "Portal de documentos").
export default function AdminPortalLinkPanel({ clientId }) {
  const { t } = useTranslation();
  const [tokenRow, setTokenRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    db.getClientPortalToken(clientId).then((row) => {
      setTokenRow(row);
      setLoading(false);
    });
  };

  useEffect(load, [clientId]);

  const url = tokenRow ? `${window.location.origin}${portalLinkPath(tokenRow.token)}` : "";
  const isExpired = tokenRow && new Date(tokenRow.expires_at).getTime() < Date.now();
  const isActive = tokenRow?.active && !isExpired;

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await db.saveClientPortalToken(clientId);
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm(t("adminPortal.confirmRevoke"))) return;
    setBusy(true);
    try {
      await db.revokeClientPortalToken(clientId);
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("adminPortal.copyPrompt"), url);
    }
  };

  if (loading) return null;

  return (
    <div className="admin-portal-link">
      {!tokenRow || !isActive ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={handleGenerate} disabled={busy}>
          {busy ? <span className="spinner" /> : null}
          {t("adminPortal.generate")}
        </button>
      ) : (
        <>
          <span className="form-hint">
            {t("adminPortal.linkReady", { date: new Date(tokenRow.expires_at).toLocaleDateString() })}
          </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleCopy}>
            {copied ? t("adminPortal.copied") : t("adminPortal.copyLink")}
          </button>
          <a
            className="btn btn-outline btn-sm"
            href={`https://wa.me/?text=${encodeURIComponent(t("adminPortal.whatsappText", { url }))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("adminPortal.shareWhatsapp")}
          </a>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleGenerate} disabled={busy}>
            {t("adminPortal.regenerate")}
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleRevoke} disabled={busy}>
            {t("adminPortal.revoke")}
          </button>
        </>
      )}
      {tokenRow && !isActive && <span className="form-hint">{t(isExpired ? "adminPortal.expired" : "adminPortal.revoked")}</span>}
    </div>
  );
}
