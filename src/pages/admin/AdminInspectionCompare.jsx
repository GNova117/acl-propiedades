import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { compareInspections, sortByImportance, suggestPair } from "../../lib/inspectionCompare";
import LoadingState from "../../components/LoadingState";
import { notifyLoadError } from "../../lib/loadError";
import "./admin.css";
import "./AdminInspections.css";

// 450: dos inspecciones lado a lado (p. ej. entrada y salida de un inquilino): qué empeoró, qué mejoró y las fotos de cada una.
// /admin/inspecciones/comparar?a=<id más vieja>&b=<id más nueva>; sin parámetros ofrece elegirlas.
export default function AdminInspectionCompare() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [inspections, setInspections] = useState(null);
  const [pair, setPair] = useState({ a: null, b: null });
  const [loadingPair, setLoadingPair] = useState(false);
  const a = params.get("a") || "";
  const b = params.get("b") || "";

  useEffect(() => {
    db.getInspections().then(setInspections).catch((err) => {
      notifyLoadError(err);
      setInspections([]);
    });
  }, []);

  // Con las dos elegidas se piden completas (con las fotos firmadas para verlas).
  useEffect(() => {
    if (!a || !b || a === b) return;
    let cancelled = false;
    setLoadingPair(true);
    Promise.all([db.getInspectionById(a), db.getInspectionById(b)])
      .then(([first, second]) => !cancelled && setPair({ a: first, b: second }))
      .catch(notifyLoadError)
      .finally(() => !cancelled && setLoadingPair(false));
    return () => {
      cancelled = true;
    };
  }, [a, b]);

  const result = useMemo(() => (pair.a && pair.b && a && b && a !== b ? compareInspections(pair.a, pair.b) : null), [pair, a, b]);
  const rows = useMemo(() => (result ? sortByImportance(result.rows) : []), [result]);

  if (!inspections) return <LoadingState />;

  const label = (i) => `${i.folio} · ${new Date(i.visited_at).toLocaleDateString(i18n.language)} · ${i.direccion}`;
  const suggest = () => {
    const first = inspections.find((i) => i.id === a) || inspections.find((i) => i.id === b);
    const suggestion = first ? suggestPair(inspections, first.property_id) : null;
    if (suggestion) setParams({ a: suggestion[0].id, b: suggestion[1].id });
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("inspections.compare.title")}</h1>
        <div className="admin-header__actions">
          <Link to="/admin/inspecciones" className="btn btn-outline">
            {t("inspections.backToList")}
          </Link>
        </div>
      </div>
      <p className="form-hint">{t("inspections.compare.hint")}</p>

      <div className="card admin-form">
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="cmp-a">{t("inspections.compare.before")}</label>
            <select id="cmp-a" value={a} onChange={(e) => setParams({ a: e.target.value, b })}>
              <option value="">{t("inspections.compare.choose")}</option>
              {inspections.map((i) => (
                <option key={i.id} value={i.id}>{label(i)}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="cmp-b">{t("inspections.compare.after")}</label>
            <select id="cmp-b" value={b} onChange={(e) => setParams({ a, b: e.target.value })}>
              <option value="">{t("inspections.compare.choose")}</option>
              {inspections.map((i) => (
                <option key={i.id} value={i.id}>{label(i)}</option>
              ))}
            </select>
          </div>
        </div>
        {(a || b) && (
          <button type="button" className="btn btn-outline btn-sm" onClick={suggest}>
            {t("inspections.compare.suggest")}
          </button>
        )}
        {a && b && a === b && <p className="form-error" role="alert">{t("inspections.compare.sameOne")}</p>}
      </div>

      {loadingPair && <LoadingState />}

      {result && !loadingPair && (
        <>
          <p className="form-hint" role="status">
            {t("inspections.compare.summary", result.summary)}
          </p>
          <div className="card admin-table-wrapper">
            <table className="admin-table inspection-compare">
              <thead>
                <tr>
                  <th>{t("inspections.compare.criterion")}</th>
                  <th>{t("inspections.compare.before")}</th>
                  <th>{t("inspections.compare.after")}</th>
                  <th>{t("inspections.compare.change")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.category}.${row.key}`} className={`inspection-compare__row inspection-compare__row--${row.change}`}>
                    <td>
                      <strong>{t(`inspections.categories.${row.category}`, { defaultValue: row.category })}</strong>
                      <div>{t(`inspections.checklist.${row.category}.${row.key}`, { defaultValue: row.key })}</div>
                    </td>
                    {[["before", row.before, row.beforePhoto], ["after", row.after, row.afterPhoto]].map(([side, state, photo]) => (
                      <td key={side}>
                        <div>{state ? t(`inspections.estado.${state}`) : "—"}</div>
                        {photo && <img src={photo} alt={t("inspections.compare.photoAlt")} className="inspection-compare__photo" loading="lazy" />}
                      </td>
                    ))}
                    <td>{t(`inspections.compare.changes.${row.change}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
