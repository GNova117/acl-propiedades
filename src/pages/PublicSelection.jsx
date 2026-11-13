import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageToggle from "../components/LanguageToggle";
import PropertyCard from "../components/PropertyCard";
import { db } from "../lib/dataStore";
import { whatsappDigits, whatsappUrl } from "../lib/format";
import { selectionUrl } from "../lib/selections";
import { OFFICE_WHATSAPP } from "../lib/office";
import "./Properties.css";
import "./PublicVisitReport.css";
import "./PublicSelection.css";

const seenKey = (token) => `acl_selection_seen_${token}`;

// Selección de propiedades que el asesor manda en un solo enlace (/seleccion/<token>): todas las propiedades con sus
// fotos, el contacto del asesor y «Me interesa» en cada una. Sin iniciar sesión. Cada apertura se anota para que el asesor
// sepa que la vio (una vez por pestaña: recargar no la cuenta de nuevo; el asesor que la previsualiza —?vista=asesor—
// no cuenta). Ver lib/selections.js y supabase/schema.sql (selection_open).
//
// Vive FUERA de PublicLayout a propósito, igual que /informe/<token>: ese layout manda cada ruta a Google Analytics y el
// token (que es lo que da acceso) no debe llegar ahí.
export default function PublicSelection() {
  const { token } = useParams();
  const { search } = useLocation();
  const { t, i18n } = useTranslation();
  const preview = new URLSearchParams(search).get("vista") === "asesor";
  // status: loading | invalid | error | ok | expired | revoked. Se guarda con el token al que pertenece: si el token de la
  // URL cambia, el resultado viejo deja de aplicar.
  const [result, setResult] = useState({ token: null, status: "loading" });
  const state = result.token === token ? result : { status: "loading" };

  // Que no se indexe ni se archive y que el navegador no mande el enlace como «referrer» a otros sitios.
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    const previousTitle = document.title;
    document.title = `${t("selection.public.pageTitle")} | ACL Propiedades`;
    return () => {
      robots.remove();
      referrer.remove();
      document.title = previousTitle;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    // Cuenta como apertura una vez por pestaña y enlace, y nunca la del asesor que previsualiza. La marca se pone ANTES de
    // pedir (en desarrollo React corre el efecto dos veces) y se quita si la petición falla.
    let track = !preview;
    try {
      if (track && sessionStorage.getItem(seenKey(token))) track = false;
      if (track) sessionStorage.setItem(seenKey(token), "1");
    } catch {
      /* sin sessionStorage: cuenta cada carga */
    }
    (async () => {
      try {
        const selection = await db.openSelection(token, { track });
        if (cancelled) return;
        if (!selection) {
          setResult({ token, status: "invalid" });
          return;
        }
        const [advisor, found] = await Promise.all([
          selection.advisor_id ? db.getAdvisorById(selection.advisor_id).catch(() => null) : null,
          Promise.all((selection.property_ids || []).map((id) => db.getPropertyById(id).catch(() => null))),
        ]);
        if (!cancelled) setResult({ token, status: selection.status, selection, advisor, properties: found.filter(Boolean) });
      } catch {
        try {
          sessionStorage.removeItem(seenKey(token));
        } catch {
          /* igual */
        }
        if (!cancelled) setResult({ token, status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, preview]);

  const { selection, advisor, properties = [] } = state;
  // Sin asesor (la armó la oficina para alguien sin asesor, o el asesor ya no está) se escribe a la oficina.
  const contactName = advisor?.name || "ACL Propiedades";
  const advisorPhone = advisor?.whatsapp || advisor?.phone || OFFICE_WHATSAPP;
  const hasAdvisorWhatsApp = whatsappDigits(advisorPhone).length >= 10;
  const url = typeof window !== "undefined" ? selectionUrl(window.location.origin, token) : "";
  const interestLink = (property) =>
    hasAdvisorWhatsApp
      ? whatsappUrl(advisorPhone, t("selection.public.interestMessage", { lng: "es", title: property.title, url: `${window.location.origin}/propiedades/${property.id}` }))
      : null;
  const generalLink = hasAdvisorWhatsApp ? whatsappUrl(advisorPhone, t("selection.public.generalMessage", { lng: "es", url })) : null;
  const expiresOn = selection?.expires_at ? new Date(selection.expires_at).toLocaleDateString(i18n.language === "en" ? "en-US" : "es-MX", { day: "numeric", month: "long" }) : "";

  const advisorBlock = (
    <div className="card public-selection__advisor">
      {advisor?.photo_url && <img src={advisor.photo_url} alt="" className="public-selection__photo" />}
      <div className="public-selection__advisor-info">
        <span className="form-hint">{advisor ? t("selection.public.advisor") : t("selection.public.office")}</span>
        <strong>{contactName}</strong>
      </div>
      <div className="public-selection__advisor-actions">
        {generalLink && (
          <a className="btn btn-primary btn-sm" href={generalLink} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        )}
        {whatsappDigits(advisor?.phone).length >= 10 && (
          <a className="btn btn-outline btn-sm" href={`tel:${whatsappDigits(advisor.phone)}`}>
            {t("selection.public.call")}
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="public-report public-selection">
      <header className="public-report__bar">
        <Link to="/" className="public-report__logo" aria-label="ACL Propiedades">
          <Logo size="sm" />
        </Link>
        <div className="public-report__tools">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="public-selection__main">
        {preview && state.status !== "loading" && (
          <p className="public-selection__preview" role="status">
            {t("selection.public.preview")}
          </p>
        )}

        {state.status === "loading" && <p className="public-report__status">{t("common.loading")}</p>}

        {state.status === "invalid" && (
          <div className="card public-report__notice">
            <h1>{t("selection.public.invalidTitle")}</h1>
            <p>{t("selection.public.invalidBody")}</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="card public-report__notice">
            <h1>{t("selection.public.errorTitle")}</h1>
            <p>{t("selection.public.errorBody")}</p>
          </div>
        )}

        {(state.status === "expired" || state.status === "revoked") && (
          <>
            <div className="card public-report__notice">
              <h1>{t(`selection.public.${state.status}Title`)}</h1>
              <p>{t(`selection.public.${state.status}Body`)}</p>
            </div>
            {advisorBlock}
          </>
        )}

        {state.status === "ok" && (
          <>
            <h1>{selection.title || t("selection.public.defaultTitle")}</h1>
            {selection.note && <p className="public-selection__note">{selection.note}</p>}
            {advisorBlock}

            {properties.length === 0 ? (
              <div className="card public-report__notice">
                <p>{t("selection.public.noProperties")}</p>
              </div>
            ) : (
              <div className="properties-grid public-selection__grid">
                {properties.map((property) => {
                  const available = property.status !== "vendida";
                  const link = available ? interestLink(property) : null;
                  return (
                    <div key={property.id} className="public-selection__item">
                      <PropertyCard property={property} />
                      <div className="public-selection__item-actions">
                        {link && (
                          <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noopener noreferrer" aria-label={t("selection.public.interestedAria", { title: property.title })}>
                            {t("selection.public.interested")}
                          </a>
                        )}
                        {!available && <span className="form-hint">{t("selection.public.unavailable")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="public-report__footer">
        <span>ACL Propiedades</span>
        {state.status === "ok" && expiresOn && <span>{t("selection.public.validUntil", { date: expiresOn })}</span>}
      </footer>
    </div>
  );
}
