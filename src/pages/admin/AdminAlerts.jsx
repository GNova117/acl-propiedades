import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { formatMXN, propertyTypeLabel, whatsappDigits } from "../../lib/format";
import { describeCriteria } from "../../lib/alertMatch";
import "./admin.css";

// Alertas que pidieron los visitantes del sitio (avisos por WhatsApp de propiedades
// nuevas y de bajas de precio). El personal las ve, las apaga o borra y puede pasar
// a la persona a Prospectos. No se puede cambiar el teléfono ni los criterios.
export default function AdminAlerts() {
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [properties, setProperties] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [kindFilter, setKindFilter] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([db.getAlerts(), db.getProperties({}).catch(() => []), db.getProspects().catch(() => [])])
      .then(([a, p, pr]) => {
        setAlerts(a);
        setProperties(p);
        setProspects(pr);
        setError("");
      })
      .catch((err) => setError(err.message || t("alerts.admin.loadError")))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const propertyById = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);
  const last10 = (v) => whatsappDigits(v).slice(-10);
  const shown = kindFilter ? alerts.filter((a) => a.kind === kindFilter) : alerts;

  const run = async (id, action) => {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      window.alert(err.message || t("alerts.admin.actionError"));
    } finally {
      setBusyId(null);
    }
  };

  const toggle = (a) => run(a.id, async () => { await db.setAlertActive(a.id, !a.active); load(); });
  const remove = (a) => {
    if (!window.confirm(t("alerts.admin.confirmDelete"))) return;
    return run(a.id, async () => { await db.deleteAlert(a.id); load(); });
  };

  const detail = (a) => {
    if (a.kind === "price") {
      const p = propertyById[a.property_id];
      return p ? (
        <>
          <strong>{p.title}</strong>
          <span className="form-hint" style={{ display: "block", margin: 0 }}>
            {t("alerts.admin.priceThen")}: {formatMXN(a.price_at_subscribe)} → {t("alerts.admin.priceNow")}: {formatMXN(p.price)}
          </span>
        </>
      ) : (
        "—"
      );
    }
    const parts = describeCriteria(a.criteria, { money: formatMXN });
    return parts.length === 0
      ? t("alerts.anyProperty")
      : parts.map(({ key, value }) => `${t(`alerts.criteria.${key}`)}: ${key === "type" ? propertyTypeLabel(t, value) : value}`).join(" · ");
  };

  // Pasa a la persona a Prospectos (origen "alerta"), avisando si ya hay uno con ese teléfono.
  const makeProspect = (a) =>
    run(a.id, async () => {
      const existing = prospects.find((p) => last10(p.phone) && last10(p.phone) === last10(a.phone));
      if (existing && !window.confirm(t("alerts.admin.prospectExists", { name: existing.name }))) return;
      const summary = a.kind === "price" ? propertyById[a.property_id]?.title || "" : detail(a);
      await db.addProspect({
        name: a.name,
        phone: a.phone,
        email: null,
        source: "alerta",
        stage: "nuevo",
        advisor_id: null,
        property_id: a.kind === "price" ? a.property_id : null,
        looking_for: typeof summary === "string" ? summary : null,
        notes: t("alerts.admin.prospectNote", { kind: t(`alerts.admin.kind_${a.kind}`) }),
        last_contact_at: null,
        next_followup_at: null,
        lost_reason: null,
      });
      window.alert(t("alerts.admin.prospectCreated"));
      load();
    });

  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("alerts.admin.title")}</h1>
          <p className="form-hint">{t("alerts.admin.subtitle")}</p>
        </div>
      </div>

      <div className="form-field" style={{ maxWidth: 260, marginBottom: "1.25rem" }}>
        <label htmlFor="al-kind">{t("alerts.admin.filterKind")}</label>
        <select id="al-kind" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="">{t("alerts.admin.all")}</option>
          <option value="search">{t("alerts.admin.kind_search")}</option>
          <option value="price">{t("alerts.admin.kind_price")}</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("alerts.admin.colPerson")}</th>
              <th>{t("alerts.admin.colType")}</th>
              <th>{t("alerts.admin.colDetail")}</th>
              <th>{t("alerts.admin.colDates")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>{t("common.loading")}</td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={6}>{t("alerts.admin.empty")}</td>
              </tr>
            ) : (
              shown.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.name}</strong>
                    <span className="form-hint" style={{ display: "block", margin: 0 }}>
                      <a href={`https://wa.me/${a.phone}`} target="_blank" rel="noopener noreferrer">
                        {a.phone.replace(/^52/, "")}
                      </a>
                    </span>
                  </td>
                  <td>{t(`alerts.admin.kind_${a.kind}`)}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{detail(a)}</td>
                  <td className="form-hint" style={{ whiteSpace: "normal" }}>
                    {t("alerts.admin.created")}: {fmt(a.created_at)}
                    <span style={{ display: "block" }}>
                      {t("alerts.admin.lastNotified")}: {fmt(a.last_notified_at)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${a.active ? "badge-available" : "badge-sold"}`}>{t(a.active ? "alerts.admin.active" : "alerts.admin.off")}</span>
                  </td>
                  <td className="admin-table__actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => toggle(a)} disabled={busyId === a.id}>
                      {t(a.active ? "alerts.admin.turnOff" : "alerts.admin.turnOn")}
                    </button>
                    {hasSection("prospectos") && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => makeProspect(a)} disabled={busyId === a.id}>
                        {t("alerts.admin.makeProspect")}
                      </button>
                    )}
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(a)} disabled={busyId === a.id}>
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
