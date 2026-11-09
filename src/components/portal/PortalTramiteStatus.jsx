import { useTranslation } from "react-i18next";
import { tramiteStagesFor, tramiteSteps } from "../../lib/clientPortal";

// "¿En qué va mi trámite?": las etapas del flujo del cliente (compra con
// crédito, de contado o venta — ver tramiteStagesFor) con la actual
// resaltada, qué significa y la nota que dejó el asesor, si hay.
export default function PortalTramiteStatus({ clientType, financiamiento, tramite }) {
  const { t, i18n } = useTranslation();
  const stages = tramiteStagesFor({ type: clientType, financiamiento });
  const steps = tramiteSteps(stages, tramite?.stage);
  const current = steps.find((s) => s.status === "actual");
  const index = steps.indexOf(current);

  return (
    <section className="card portal-tramite" aria-labelledby="portal-tramite-title">
      <div className="portal-tramite__header">
        <h2 id="portal-tramite-title">{t("portal.tramite.title")}</h2>
        <span className="form-hint">{t("portal.tramite.stepOf", { step: index + 1, total: steps.length })}</span>
      </div>

      <ol className="portal-tramite__steps">
        {steps.map((step) => (
          <li key={step.key} className={`portal-tramite__step portal-tramite__step--${step.status}`} aria-current={step.status === "actual" ? "step" : undefined}>
            <span className="portal-tramite__dot" aria-hidden="true">{step.status === "hecha" ? "✓" : ""}</span>
            <span className="portal-tramite__label">{t(`portal.tramite.stages.${step.key}.title`)}</span>
          </li>
        ))}
      </ol>

      <div className="portal-tramite__current">
        <strong>{t(`portal.tramite.stages.${current.key}.title`)}</strong>
        <p>{t(`portal.tramite.stages.${current.key}.body`)}</p>
        {tramite?.note && (
          <blockquote className="portal-tramite__note">
            <span className="form-hint">{t("portal.tramite.noteFromAdvisor")}</span>
            <p>{tramite.note}</p>
          </blockquote>
        )}
        {tramite?.updated_at && (
          <span className="form-hint">
            {t("portal.tramite.updatedAt", { date: new Date(tramite.updated_at).toLocaleDateString(i18n.language, { day: "numeric", month: "long" }) })}
          </span>
        )}
      </div>
    </section>
  );
}
