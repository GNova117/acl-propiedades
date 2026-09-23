import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageToggle from "../components/LanguageToggle";
import VisitReportView from "../components/VisitReportView";
import { db } from "../lib/dataStore";
import { formatVisitDate } from "../lib/visitReport";
import { visitPdfLabels } from "../lib/visitReportLabels";
import "./PublicVisitReport.css";

// Informe de visitas que recibe el vendedor por un enlace privado
// (/informe/<token>): solo lectura, sin iniciar sesión, sin nombres de
// prospectos (la base de datos ni siquiera se los manda).
//
// Vive FUERA de PublicLayout a propósito: ese layout registra cada ruta en
// Google Analytics, y el token (que es lo que da acceso) no debe llegar ahí —
// tampoco necesita el menú, el botón de WhatsApp ni las decoraciones del sitio.
export default function PublicVisitReport() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  // status: "loading" | "ready" | "invalid" (enlace inexistente/regenerado/
  // desactivado) | "error". Se guarda junto con el token al que pertenece: si el
  // token de la URL cambia, el resultado viejo deja de aplicar y se vuelve a
  // "loading" derivándolo al renderizar, sin poner estado dentro del efecto.
  const [result, setResult] = useState({ token: null, status: "loading", payload: null });
  const state = result.token === token ? result : { status: "loading", payload: null };
  const [pdfBusy, setPdfBusy] = useState(false);
  const now = useMemo(() => new Date(), []);

  // Que no se indexe ni se archive, y que el navegador no mande el enlace como
  // "referrer" a otros sitios. Se quitan al salir para no dejar esas etiquetas
  // pegadas al navegar dentro de la SPA.
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    const previousTitle = document.title;
    document.title = `${t("visits.public.pageTitle")} | ACL Propiedades`;
    return () => {
      robots.remove();
      referrer.remove();
      document.title = previousTitle;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    db.getVisitReportByToken(token)
      .then((payload) => !cancelled && setResult(payload ? { token, status: "ready", payload } : { token, status: "invalid", payload: null }))
      .catch(() => !cancelled && setResult({ token, status: "error", payload: null }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadVisitReportPdf } = await import("../lib/visitReportPdf");
      const { payload } = state;
      await downloadVisitReportPdf(payload, visitPdfLabels(t, i18n.language, payload, new Date()), `informe-visitas-${payload.property.code || "acl"}`);
    } catch (err) {
      window.alert(err.message || t("visits.report.pdfError"));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="public-report">
      <header className="public-report__bar">
        <Link to="/" className="public-report__logo" aria-label="ACL Propiedades">
          <Logo size="sm" />
        </Link>
        <div className="public-report__tools">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="public-report__main">
        <h1>{t("visits.public.title")}</h1>

        {state.status === "loading" && <p className="public-report__status">{t("common.loading")}</p>}

        {state.status === "invalid" && (
          <div className="card public-report__notice">
            <h2>{t("visits.public.invalidTitle")}</h2>
            <p>{t("visits.public.invalidBody")}</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="card public-report__notice">
            <h2>{t("visits.public.errorTitle")}</h2>
            <p>{t("visits.public.errorBody")}</p>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <p className="public-report__intro">{t("visits.public.intro")}</p>
            <VisitReportView payload={state.payload} now={now} />
            <div className="public-report__actions vr-noprint">
              <button type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={pdfBusy}>
                {pdfBusy ? <span className="spinner" /> : null}
                {t("visits.report.downloadPdf")}
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="public-report__footer">
        <span>ACL Propiedades</span>
        {state.status === "ready" && <span>{t("visits.public.updated", { date: formatVisitDate(now.toISOString(), i18n.language) })}</span>}
      </footer>
    </div>
  );
}
