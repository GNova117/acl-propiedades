import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildVisitReport, formatVisitDateTime, reasonLabel } from "../lib/visitReport";
import "./VisitReportView.css";

// Cuántas visitas se muestran en la bitácora antes de "Ver todas".
const LOG_PAGE_SIZE = 10;

const STATUS_BADGE = { disponible: "badge-available", apartada: "badge-reserved", vendida: "badge-sold" };

function Tile({ label, value, note }) {
  return (
    <div className="vr-tile">
      <dt>{label}</dt>
      <dd>
        <span className="vr-tile__value">{value}</span>
        {note && <span className="vr-tile__note">{note}</span>}
      </dd>
    </div>
  );
}

// Gráfica de motivos: una sola serie, así que un solo color y sin leyenda (el
// título ya dice qué se mide). El valor va al final de cada barra (nunca dentro,
// para que no se corte) y la misma información existe como tabla.
function ReasonsChart({ report }) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  const { reasons, totalVisits } = report;
  const max = Math.max(1, ...reasons.map((r) => r.count));

  return (
    <figure className="vr-card vr-chart">
      <div className="vr-card__head">
        <div>
          <h3>{t("visits.report.reasonsTitle")}</h3>
          <p className="vr-muted">{t("visits.report.reasonsNote")}</p>
        </div>
        {reasons.length > 0 && (
          <button type="button" className="btn btn-outline btn-sm vr-noprint" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            {asTable ? t("visits.report.viewChart") : t("visits.report.viewTable")}
          </button>
        )}
      </div>

      {reasons.length === 0 ? (
        <p className="vr-empty">{t("visits.report.reasonsEmpty")}</p>
      ) : asTable ? (
        <table className="vr-table">
          <thead>
            <tr>
              <th scope="col">{t("visits.report.reasonCol")}</th>
              <th scope="col" className="vr-num">{t("visits.report.mentionsCol")}</th>
              <th scope="col" className="vr-num">%</th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((row) => (
              <tr key={row.key}>
                <th scope="row">{reasonLabel(t, row.key)}</th>
                <td className="vr-num">{row.count}</td>
                <td className="vr-num">{row.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="vr-bars">
          {reasons.map((row) => (
            <li key={row.key} className="vr-bar" tabIndex={0}>
              <span className="vr-bar__label">{reasonLabel(t, row.key)}</span>
              <span className="vr-bar__plot" aria-hidden="true">
                <span className="vr-bar__fill" style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <span className="vr-bar__value">
                <strong>{row.pct}%</strong>
                <span className="vr-muted"> ({row.count})</span>
              </span>
              <span className="vr-bar__tip" role="tooltip">
                <strong>{row.pct}%</strong> · {t("visits.report.reasonTip", { count: row.count, total: totalVisits })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function VisitLog({ report }) {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const { log } = report;
  const shown = showAll ? log : log.slice(0, LOG_PAGE_SIZE);

  return (
    <section className="vr-card">
      <h3>{t("visits.report.logTitle")}</h3>
      <p className="vr-muted">{t("visits.report.logNote")}</p>

      {log.length === 0 ? (
        <p className="vr-empty">{t("visits.report.logEmpty")}</p>
      ) : (
        <>
          <ol className="vr-log">
            {shown.map((visit, i) => (
              <li key={`${visit.visited_at}-${i}`} className="vr-entry">
                <div className="vr-entry__head">
                  <time dateTime={visit.visited_at}>{formatVisitDateTime(visit.visited_at, i18n.language)}</time>
                  <span className={`vr-badge vr-badge--${visit.interest}`}>{t(`visits.interest.${visit.interest}`)}</span>
                </div>
                {visit.reasons?.length > 0 && (
                  <ul className="vr-chips">
                    {visit.reasons.map((key) => (
                      <li key={key}>{reasonLabel(t, key)}</li>
                    ))}
                  </ul>
                )}
                {visit.comments && <p className="vr-entry__comment">{visit.comments}</p>}
              </li>
            ))}
          </ol>
          {log.length > LOG_PAGE_SIZE && (
            <button type="button" className="btn btn-outline btn-sm vr-noprint" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t("visits.report.showFewer") : t("visits.report.showAll", { count: log.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// El informe del vendedor: contadores, gráfica de motivos e historial de
// observaciones. Lo usan la vista previa del asesor (/admin/visitas/propiedad/:id)
// y la página pública por enlace (/informe/:token) — es el MISMO componente
// sobre el MISMO JSON anonimizado, así lo que el asesor previsualiza es lo que
// recibe el vendedor.
export default function VisitReportView({ payload, now }) {
  const { t } = useTranslation();
  const report = useMemo(() => buildVisitReport(payload, { now }), [payload, now]);
  const property = payload?.property || {};

  return (
    <div className="visit-report">
      <header className="vr-head">
        {property.main_image && <img className="vr-head__img" src={property.main_image} alt="" />}
        <div className="vr-head__text">
          <p className="vr-head__meta">{[property.code, property.zone].filter(Boolean).join(" · ")}</p>
          <h2>{property.title}</h2>
          {property.status && <span className={`badge ${STATUS_BADGE[property.status] || ""}`}>{t(`propertyStatus.${property.status}`)}</span>}
        </div>
      </header>

      <dl className="vr-tiles" aria-label={t("visits.report.summary")}>
        <Tile
          label={t("visits.report.daysOnMarket")}
          value={report.daysOnMarket == null ? "—" : report.daysOnMarket}
          note={report.sold ? t("visits.report.untilSale") : null}
        />
        <Tile label={t("visits.report.totalVisits")} value={report.totalVisits} />
        <Tile
          label={t("visits.report.interested")}
          value={report.interested}
          note={report.withOffer > 0 ? t("visits.report.withOffer", { count: report.withOffer }) : null}
        />
        <Tile label={t("visits.report.discarded")} value={report.discarded} />
      </dl>

      <ReasonsChart report={report} />
      <VisitLog report={report} />
    </div>
  );
}
