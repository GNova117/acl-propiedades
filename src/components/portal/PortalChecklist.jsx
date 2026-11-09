import { useTranslation } from "react-i18next";
import { checklistSummary } from "../../lib/clientPortal";
import PortalChecklistBadge from "./PortalChecklistBadge";

// "Tus pendientes": de un vistazo qué documentos faltan, cuáles se están
// revisando y cuáles ya están listos, con una barra de avance. Cada fila
// lleva a la tarjeta de ese documento más abajo.
export default function PortalChecklist({ items }) {
  const { t } = useTranslation();
  const summary = checklistSummary(items);
  const percent = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  const goTo = (docType) => (e) => {
    e.preventDefault();
    document.getElementById(`portal-doc-${docType}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="card portal-checklist" aria-labelledby="portal-checklist-title">
      <div className="portal-checklist__header">
        <h2 id="portal-checklist-title">{t("portal.checklist.title")}</h2>
        <span className="portal-checklist__count">{t("portal.checklist.progress", { done: summary.done, total: summary.total })}</span>
      </div>
      <div
        className="portal-checklist__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={summary.total}
        aria-valuenow={summary.done}
        aria-label={t("portal.checklist.progress", { done: summary.done, total: summary.total })}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="form-hint portal-checklist__summary">
        {summary.todo > 0
          ? t("portal.checklist.todo", { count: summary.todo })
          : summary.inReview > 0
            ? t("portal.checklist.allSentInReview", { count: summary.inReview })
            : t("portal.checklist.allDone")}
      </p>
      <ul className="portal-checklist__list">
        {items.map((item) => (
          <li key={item.docType}>
            <a href={`#portal-doc-${item.docType}`} onClick={goTo(item.docType)}>
              {t(`documentCapture.docTypes.${item.docType}`)}
            </a>
            <PortalChecklistBadge state={item.state} />
          </li>
        ))}
      </ul>
    </section>
  );
}
