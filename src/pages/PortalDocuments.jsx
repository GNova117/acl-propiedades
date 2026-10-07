import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageToggle from "../components/LanguageToggle";
import PortalPrivacyConsent from "../components/portal/PortalPrivacyConsent";
import PortalDocumentCard from "../components/portal/PortalDocumentCard";
import { db } from "../lib/dataStore";
import { OFFICE_WHATSAPP } from "../lib/office";
import { PORTAL_DOC_TYPES, PORTAL_OFFICIAL_URLS, PORTAL_CONSENT_VERSION, latestPortalDoc } from "../lib/clientPortal";
import "./PortalDocuments.css";

const CONSENT_KEY_PREFIX = "acl_portal_consent_";

// Página pública /documentos/<token>: el cliente descarga él mismo su
// Constancia de Situación Fiscal y su Acta de Nacimiento en los portales
// oficiales (nunca en este sitio) y sube el PDF aquí. Sin login — el token
// del enlace (que solo genera el asesor desde /admin/clientes/:id/documentos)
// es lo único que da acceso, igual patrón que /informe/<token> y /firmar/<token>.
export default function PortalDocuments() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [result, setResult] = useState({ token: null, status: "loading", payload: null });
  const state = result.token === token ? result : { status: "loading", payload: null };
  const [consentDone, setConsentDone] = useState(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = `${t("portal.pageTitle")} | ACL Propiedades`;
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, [t]);

  const load = useCallback(() => {
    db.getPortalStatus(token)
      .then((payload) => setResult({ token, status: payload?.status || "invalido", payload }))
      .catch(() => setResult({ token, status: "error", payload: null }));
  }, [token]);

  useEffect(load, [load]);

  useEffect(() => {
    try {
      setConsentDone(sessionStorage.getItem(CONSENT_KEY_PREFIX + token) === "1");
    } catch {
      setConsentDone(false);
    }
  }, [token]);

  const handleAcceptConsent = async () => {
    await db.registerPortalConsent(token, PORTAL_CONSENT_VERSION);
    try {
      sessionStorage.setItem(CONSENT_KEY_PREFIX + token, "1");
    } catch {
      /* localStorage/sessionStorage puede fallar (modo privado) — no bloquea seguir */
    }
    setConsentDone(true);
  };

  const documents = state.payload?.documents || [];
  const allConfirmedAndValid = PORTAL_DOC_TYPES.every((docType) => {
    const doc = latestPortalDoc(documents, docType);
    return doc && doc.review_status !== "rechazado";
  });

  return (
    <div className="portal-page">
      <header className="portal-page__bar">
        <Logo size="sm" />
        <div className="portal-page__tools">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="portal-page__main">
        {state.status === "loading" && <p className="form-hint">{t("common.loading")}</p>}

        {state.status === "invalido" && (
          <div className="card portal-page__notice">
            <h2>{t("portal.invalidTitle")}</h2>
            <p>{t("portal.invalidBody")}</p>
          </div>
        )}
        {state.status === "desactivado" && (
          <div className="card portal-page__notice">
            <h2>{t("portal.revokedTitle")}</h2>
            <p>{t("portal.revokedBody")}</p>
          </div>
        )}
        {state.status === "expirado" && (
          <div className="card portal-page__notice">
            <h2>{t("portal.expiredTitle")}</h2>
            <p>{t("portal.expiredBody")}</p>
          </div>
        )}
        {state.status === "error" && (
          <div className="card portal-page__notice">
            <h2>{t("portal.errorTitle")}</h2>
            <p>{t("portal.errorBody")}</p>
          </div>
        )}

        {state.status === "activo" && !consentDone && <PortalPrivacyConsent onAccept={handleAcceptConsent} />}

        {state.status === "activo" && consentDone && (
          <>
            <h1>{state.payload.client_name ? t("portal.greeting", { name: state.payload.client_name }) : t("portal.greetingGeneric")}</h1>
            <p className="portal-page__intro">{t("portal.intro")}</p>

            <div className="portal-page__cards">
              {PORTAL_DOC_TYPES.map((docType) => (
                <PortalDocumentCard
                  key={docType}
                  token={token}
                  docType={docType}
                  officialUrl={PORTAL_OFFICIAL_URLS[docType]}
                  doc={latestPortalDoc(documents, docType)}
                  backupDoc={latestPortalDoc(documents, docType, "backup_image")}
                  onChanged={load}
                />
              ))}
            </div>

            {allConfirmedAndValid && (
              <div className="card portal-page__summary">
                <p>{t("portal.summary.done")}</p>
                <a
                  className="btn btn-primary"
                  href={`https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(t("portal.summary.whatsappText"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("portal.summary.notifyAdvisor")}
                </a>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="portal-page__footer">
        <span>ACL Propiedades</span>
      </footer>
    </div>
  );
}
