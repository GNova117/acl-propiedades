import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageToggle from "../components/LanguageToggle";
import PortalPrivacyConsent from "../components/portal/PortalPrivacyConsent";
import PortalDocumentCard from "../components/portal/PortalDocumentCard";
import PortalChecklist from "../components/portal/PortalChecklist";
import PortalTramiteStatus from "../components/portal/PortalTramiteStatus";
import { db } from "../lib/dataStore";
import { OFFICE_WHATSAPP } from "../lib/office";
import { PORTAL_OFFICIAL_LINKS, PORTAL_CONSENT_VERSION, checklistSummary, clientTodo, latestPortalDoc, portalChecklist, requestedDocsFor } from "../lib/clientPortal";
import "./PortalDocuments.css";

const CONSENT_KEY_PREFIX = "acl_portal_consent_";

// Página pública /documentos/<token>: el portal del cliente. Arriba ve en qué
// etapa va su trámite y su lista de pendientes; abajo, una tarjeta por cada
// documento que su asesor le pidió (constancia y acta las descarga él mismo
// de los portales oficiales, nunca en este sitio; INE, recibos o escrituras
// los sube en PDF o foto). Sin login — el token
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

  const payload = state.payload || {};
  const documents = payload.documents || [];
  const requestedDocs = requestedDocsFor(payload.tramite, payload.client_type);
  const checklist = portalChecklist(requestedDocs, documents, payload.office_documents || []);
  const summary = checklistSummary(checklist);
  // Primero lo que le toca hacer (corregir, luego pendientes) y al final lo
  // que ya mandó o entregó: así lo siguiente siempre está arriba.
  const todo = clientTodo(checklist);
  const orderedItems = [...todo, ...checklist.filter((i) => !todo.includes(i))];
  const allSent = summary.total > 0 && summary.todo === 0;
  const notifyText = t("portal.summary.whatsappText", {
    docs: checklist.map((i) => t(`documentCapture.docTypes.${i.docType}`)).join(", "),
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
            <h1>{payload.client_name ? t("portal.greeting", { name: payload.client_name }) : t("portal.greetingGeneric")}</h1>
            <p className="portal-page__intro">{t("portal.intro")}</p>

            <PortalTramiteStatus clientType={payload.client_type} financiamiento={payload.financiamiento} tramite={payload.tramite} />

            <PortalChecklist items={checklist} />

            <h2 className="portal-page__section-title">{t("portal.documentsTitle")}</h2>
            <div className="portal-page__cards">
              {orderedItems.map((item) => (
                <PortalDocumentCard
                  key={`${item.docType}-${item.doc?.id || item.doc?.captured_at || "none"}`}
                  token={token}
                  item={item}
                  officialUrl={PORTAL_OFFICIAL_LINKS[item.docType]}
                  backupDoc={latestPortalDoc(documents, item.docType, "backup_image")}
                  onChanged={load}
                />
              ))}
            </div>

            {allSent && (
              <div className="card portal-page__summary">
                <p>{summary.inReview > 0 ? t("portal.summary.done") : t("portal.summary.allApproved")}</p>
                <a
                  className="btn btn-primary"
                  href={`https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(notifyText)}`}
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
