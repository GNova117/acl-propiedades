import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { db } from "../lib/dataStore";
import "./PublicForms.css";

// Enlace de baja que llevan todos los avisos por WhatsApp (/alertas/baja/<token>).
// Se apaga sola la alerta de ese aviso; no hay que iniciar sesión ni dar datos.
export default function AlertUnsubscribe() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [state, setState] = useState("idle"); // idle | working | done | notFound | error

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const unsubscribe = async () => {
    setState("working");
    try {
      const result = await db.unsubscribeAlert(token);
      setState(result?.ok ? "done" : "notFound");
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <Seo title={t("alerts.unsubscribe.title")} description={t("alerts.unsubscribe.text")} />
      <div className="container public-form-page">
        <div className="card public-form-card" style={{ marginTop: "2.5rem", textAlign: "center" }}>
          {state === "done" ? (
            <>
              <h1 style={{ fontSize: "1.6rem" }}>{t("alerts.unsubscribe.doneTitle")}</h1>
              <p className="form-hint">{t("alerts.unsubscribe.doneText")}</p>
              <Link to="/propiedades" className="btn btn-outline">
                {t("alerts.unsubscribe.browse")}
              </Link>
            </>
          ) : state === "notFound" ? (
            <>
              <h1 style={{ fontSize: "1.6rem" }}>{t("alerts.unsubscribe.notFoundTitle")}</h1>
              <p className="form-hint">{t("alerts.unsubscribe.notFoundText")}</p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: "1.6rem" }}>{t("alerts.unsubscribe.title")}</h1>
              <p className="form-hint">{t("alerts.unsubscribe.text")}</p>
              {state === "error" && <p className="form-error">{t("alerts.errors.generic")}</p>}
              <button type="button" className="btn btn-primary" onClick={unsubscribe} disabled={state === "working"}>
                {state === "working" ? <span className="spinner" /> : null}
                {t("alerts.unsubscribe.button")}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
