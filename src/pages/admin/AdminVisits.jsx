import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { exportToCsv } from "../../lib/csvExport";
import { useAuth } from "../../context/AuthContext";
import VisitProspect from "../../components/VisitProspect";
import { VISIT_INTERESTS, formatVisitDateTime, reasonLabel } from "../../lib/visitReport";
import "../../components/VisitReportView.css";
import "./admin.css";
import "./AdminVisits.css";

// Lista de visitas registradas. RLS ya recorta del lado de Supabase: un asesor
// con login vinculado a su perfil ve SOLO las suyas; un correo sin asesor
// vinculado (oficina, administración) ve las de todos y puede filtrar por
// asesor. Aquí solo se añade ese selector y los demás filtros de la vista.
export default function AdminVisits() {
  const { t, i18n } = useTranslation();
  const { advisorId } = useAuth();
  const seesAll = advisorId == null;

  const [visits, setVisits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [interestFilter, setInterestFilter] = useState("");
  const [followFilter, setFollowFilter] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([db.getVisits(), db.getProperties({}), db.getAdvisors()])
      .then(([visitData, propertyData, advisorData]) => {
        setVisits(visitData);
        setProperties(propertyData);
        setAdvisors(advisorData);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message || "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const potentialCount = useMemo(() => visits.filter((v) => v.potential_client).length, [visits]);
  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "—";
  const propertyLabel = (id) => {
    const p = propertyById.get(id);
    return p ? [p.code, p.title].filter(Boolean).join(" · ") : "—";
  };

  const visible = useMemo(
    () =>
      visits.filter(
        (v) =>
          (!propertyFilter || v.property_id === propertyFilter) &&
          (!advisorFilter || v.advisor_id === advisorFilter) &&
          (!interestFilter || v.interest === interestFilter) &&
          (!followFilter || v.potential_client)
      ),
    [visits, propertyFilter, advisorFilter, interestFilter, followFilter]
  );

  // Solo se ofrecen las propiedades que ya tienen visitas: filtrar por una sin
  // visitas nunca devolvería nada.
  const propertiesWithVisits = useMemo(() => {
    const ids = new Set(visits.map((v) => v.property_id));
    return properties.filter((p) => ids.has(p.id)).sort((a, b) => propertyLabel(a.id).localeCompare(propertyLabel(b.id), "es"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, properties]);

  const handleDelete = async (id) => {
    if (!window.confirm(t("visits.confirmDelete"))) return;
    try {
      await db.deleteVisit(id);
      load();
    } catch (err) {
      window.alert(err.message || t("visits.form.saveError"));
    }
  };

  const handleExport = () => {
    exportToCsv("visitas.csv", visible, [
      { label: t("visits.table.when"), value: (v) => formatVisitDateTime(v.visited_at, i18n.language) },
      { label: t("detail.code"), value: (v) => propertyById.get(v.property_id)?.code || "" },
      { label: t("visits.table.property"), value: (v) => propertyById.get(v.property_id)?.title || "" },
      { label: t("visits.table.prospect"), key: "prospect_name" },
      { label: t("visits.potentialClient"), value: (v) => (v.potential_client ? t("visits.yes") : t("visits.no")) },
      { label: t("visits.form.prospectPhone"), key: "prospect_phone" },
      { label: t("visits.form.lookingFor"), key: "looking_for" },
      { label: t("visits.table.interest"), value: (v) => t(`visits.interest.${v.interest}`) },
      { label: t("visits.table.reasons"), value: (v) => (v.reasons || []).map((k) => reasonLabel(t, k)).join(", ") },
      { label: t("visits.table.advisor"), value: (v) => advisorName(v.advisor_id) },
      { label: t("visits.form.comments"), key: "comments" },
      { label: t("visits.form.internalNotes"), key: "internal_notes" },
    ]);
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{seesAll ? t("visits.allTitle") : t("visits.myTitle")}</h1>
        <div className="admin-header__actions">
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={visible.length === 0}>
            {t("common.exportCsv")}
          </button>
          <Link to="/admin/visitas/nueva" className="btn btn-primary">
            {t("visits.newVisit")}
          </Link>
        </div>
      </div>

      {loadError && <p className="form-error">{t("visits.loadError", { error: loadError })}</p>}

      <div className="visits-filters">
        <div className="form-field">
          <label htmlFor="visits-property">{t("visits.table.property")}</label>
          <select id="visits-property" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
            <option value="">{t("visits.filters.allProperties")}</option>
            {propertiesWithVisits.map((p) => (
              <option key={p.id} value={p.id}>
                {propertyLabel(p.id)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="visits-interest">{t("visits.table.interest")}</label>
          <select id="visits-interest" value={interestFilter} onChange={(e) => setInterestFilter(e.target.value)}>
            <option value="">{t("visits.filters.allInterests")}</option>
            {VISIT_INTERESTS.map((key) => (
              <option key={key} value={key}>
                {t(`visits.interest.${key}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="visits-follow">{t("visits.filters.followUp")}</label>
          <select id="visits-follow" value={followFilter} onChange={(e) => setFollowFilter(e.target.value)}>
            <option value="">{t("visits.filters.allVisits")}</option>
            <option value="potential">{t("visits.filters.onlyPotential", { count: potentialCount })}</option>
          </select>
        </div>
        {seesAll && (
          <div className="form-field">
            <label htmlFor="visits-advisor">{t("visits.table.advisor")}</label>
            <select id="visits-advisor" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
              <option value="">{t("visits.filters.allAdvisors")}</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table visits-table">
          <thead>
            <tr>
              <th>{t("visits.table.when")}</th>
              <th>{t("visits.table.property")}</th>
              <th>{t("visits.table.prospect")}</th>
              <th>{t("visits.table.interest")}</th>
              <th>{t("visits.table.reasons")}</th>
              {seesAll && <th>{t("visits.table.advisor")}</th>}
              <th>{t("visits.table.comment")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={seesAll ? 8 : 7}>{t("common.loading")}</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={seesAll ? 8 : 7}>{visits.length === 0 ? t("visits.empty") : t("visits.noMatches")}</td>
              </tr>
            ) : (
              visible.map((visit) => (
                <tr key={visit.id}>
                  <td className="visits-table__when">{formatVisitDateTime(visit.visited_at, i18n.language)}</td>
                  <td>
                    <Link to={`/admin/visitas/propiedad/${visit.property_id}`}>{propertyLabel(visit.property_id)}</Link>
                  </td>
                  <td>
                    <VisitProspect visit={visit} />
                  </td>
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
                  <td className="visits-table__comment">{visit.comments ? <span>{visit.comments}</span> : "—"}</td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/visitas/${visit.id}`} state={{ from: "/admin/visitas" }} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(visit.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
