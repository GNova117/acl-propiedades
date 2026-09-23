import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import VisitReportView from "../../components/VisitReportView";
import { formatVisitDate, formatVisitDateTime, reasonLabel, reportUrl } from "../../lib/visitReport";
import { visitPdfLabels } from "../../lib/visitReportLabels";
import "../../components/VisitReportView.css";
import "./admin.css";
import "./AdminVisits.css";

// Informe de visitas de UNA propiedad: la vista previa exacta de lo que recibe
// el vendedor (mismo componente, mismo JSON anonimizado), el enlace privado
// para mandárselo y el PDF. Debajo, el registro interno con los nombres de los
// prospectos y las notas, que el vendedor nunca ve.
//
// La ruta es /admin/visitas/propiedad/:propertyId sin importar el tipo de
// propiedad (a diferencia de la Bitácora, que cuelga de /propiedades o
// /naves-industriales): este apartado se otorga por rol 'visitas', no por el
// tipo de propiedad, y así no hay dos rutas para lo mismo.
export default function AdminPropertyVisits() {
  const { propertyId } = useParams();
  const { t, i18n } = useTranslation();
  const { advisorId } = useAuth();
  const seesAll = advisorId == null;

  const [report, setReport] = useState(null);
  const [visits, setVisits] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const urlInput = useRef(null);
  // Fijo por carga: los días en el mercado no cambian mientras la página está abierta.
  const now = useMemo(() => new Date(), []);

  const load = () => {
    setLoading(true);
    Promise.all([db.getVisitReport(propertyId), db.getVisits({ propertyId }), db.getReportLink(propertyId), db.getAdvisors()])
      .then(([reportData, visitData, linkData, advisorData]) => {
        setReport(reportData);
        setVisits(visitData);
        setLink(linkData);
        setAdvisors(advisorData);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message || "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [propertyId]);

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "—";
  const url = link ? reportUrl(link.token) : "";
  const propertyTitle = report?.property?.title || "";
  const back = `/admin/visitas/propiedad/${propertyId}`;

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      window.alert(err.message || t("visits.form.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const createLink = () => run(async () => setLink(await db.saveReportLink(propertyId)));

  const regenerateLink = () => {
    if (!window.confirm(t("visits.share.confirmRegenerate"))) return;
    return run(async () => {
      setLink(await db.saveReportLink(propertyId));
      setCopyState("");
    });
  };

  const disableLink = () => {
    if (!window.confirm(t("visits.share.confirmDisable"))) return;
    return run(async () => {
      await db.deleteReportLink(propertyId);
      setLink(null);
      setCopyState("");
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      // Sin permiso de portapapeles (o http en una prueba en el celular): se deja
      // el enlace seleccionado para copiarlo a mano.
      urlInput.current?.select();
      setCopyState("manual");
    }
  };

  const handleDeleteVisit = async (id) => {
    if (!window.confirm(t("visits.confirmDelete"))) return;
    try {
      await db.deleteVisit(id);
      load();
    } catch (err) {
      window.alert(err.message || t("visits.form.saveError"));
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(t("visits.share.whatsappMessage", { title: propertyTitle, url }))}`;

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadVisitReportPdf } = await import("../../lib/visitReportPdf");
      await downloadVisitReportPdf(report, visitPdfLabels(t, i18n.language, report, new Date()), `informe-visitas-${report.property.code || propertyTitle}`);
    } catch (err) {
      window.alert(err.message || t("visits.report.pdfError"));
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading && !report) return <div className="empty-state">{t("common.loading")}</div>;

  if (loadError || !report) {
    return (
      <div>
        <div className="admin-header">
          <h1>{t("visits.propertyTitle")}</h1>
          <Link to="/admin/visitas" className="btn btn-outline">
            {t("visits.backToList")}
          </Link>
        </div>
        <p className="form-error">{loadError ? t("visits.loadError", { error: loadError }) : t("visits.property.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="visit-property">
      <div className="admin-header">
        <div>
          <h1>{t("visits.propertyTitle")}</h1>
          <p className="form-hint">{[report.property.code, propertyTitle].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="admin-header__actions">
          <Link to={`/admin/visitas/nueva?propiedad=${propertyId}`} className="btn btn-primary">
            {t("visits.newVisit")}
          </Link>
          <button type="button" className="btn btn-outline" onClick={handleDownloadPdf} disabled={pdfBusy}>
            {pdfBusy ? <span className="spinner" /> : null}
            {t("visits.report.downloadPdf")}
          </button>
          <Link to="/admin/visitas" className="btn btn-outline">
            {t("visits.backToList")}
          </Link>
        </div>
      </div>

      <section className="card visit-share">
        <h2>{t("visits.share.title")}</h2>
        <p className="visit-note">{t("visits.share.intro")}</p>
        {link ? (
          <>
            <div className="visit-share__url">
              <input ref={urlInput} type="text" readOnly value={url} aria-label={t("visits.share.linkLabel")} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-outline" onClick={copyLink}>
                {copyState === "copied" ? `✓ ${t("visits.share.copied")}` : t("visits.share.copy")}
              </button>
            </div>
            {copyState === "manual" && <p className="visit-note">{t("visits.share.copyManual")}</p>}
            <div className="visit-share__actions">
              <a href={url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                {t("visits.share.open")}
              </a>
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                {t("visits.share.whatsapp")}
              </a>
              <button type="button" className="btn btn-outline btn-sm" onClick={regenerateLink} disabled={busy}>
                {t("visits.share.regenerate")}
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={disableLink} disabled={busy}>
                {t("visits.share.disable")}
              </button>
            </div>
            <p className="visit-note" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              {t("visits.share.createdOn", { date: formatVisitDate(link.created_at, i18n.language) })} {t("visits.share.rotateHint")}
            </p>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={createLink} disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            {t("visits.share.create")}
          </button>
        )}
      </section>

      <section>
        <h2 className="visit-section-title">{t("visits.preview.title")}</h2>
        <p className="visit-note">{t("visits.preview.hint")}</p>
        <VisitReportView payload={report} now={now} />
      </section>

      <section>
        <h2 className="visit-section-title">{t("visits.internal.title")}</h2>
        <p className="visit-note">
          {t("visits.internal.hint")} {!seesAll && t("visits.internal.ownOnly")}
        </p>
        <div className="card admin-table-wrapper">
          <table className="admin-table visits-table">
            <thead>
              <tr>
                <th>{t("visits.table.when")}</th>
                <th>{t("visits.table.prospect")}</th>
                <th>{t("visits.table.interest")}</th>
                <th>{t("visits.table.reasons")}</th>
                {seesAll && <th>{t("visits.table.advisor")}</th>}
                <th>{t("visits.table.comment")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr>
                  <td colSpan={seesAll ? 7 : 6}>{t("visits.internal.empty")}</td>
                </tr>
              ) : (
                visits.map((visit) => (
                  <tr key={visit.id}>
                    <td className="visits-table__when">{formatVisitDateTime(visit.visited_at, i18n.language)}</td>
                    <td>{visit.prospect_name || "—"}</td>
                    <td>
                      <span className={`vr-badge vr-badge--${visit.interest}`}>{t(`visits.interest.${visit.interest}`)}</span>
                    </td>
                    <td className="visits-table__reasons">
                      {visit.reasons?.length > 0 ? (
                        <ul className="vr-chips">
                          {visit.reasons.map((key) => (
                            <li key={key}>{reasonLabel(t, key)}</li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                    {seesAll && <td>{advisorName(visit.advisor_id)}</td>}
                    <td className="visits-table__comment">
                      {visit.comments ? <span>{visit.comments}</span> : "—"}
                      {visit.internal_notes && (
                        <div className="visit-note" style={{ margin: "0.35rem 0 0" }}>
                          <strong>{t("visits.form.internalNotes")}:</strong> {visit.internal_notes}
                        </div>
                      )}
                    </td>
                    <td className="admin-table__actions">
                      <Link to={`/admin/visitas/${visit.id}`} state={{ from: back }} className="btn btn-outline btn-sm">
                        {t("common.edit")}
                      </Link>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteVisit(visit.id)}>
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
