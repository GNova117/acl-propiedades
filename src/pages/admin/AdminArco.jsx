import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { confirmDialog, notify } from "../../lib/toast";
import LoadingState from "../../components/LoadingState";
import "./admin.css";

// Derechos ARCO (Acceso, Rectificación, Cancelación, Oposición): atender a quien pide ver o borrar sus datos. La persona se busca
// por teléfono o correo completo (nunca por nombre). Todo vive en la base (migración 0125); aquí solo se pide y se muestra.
// Rectificación y Oposición se atienden con las pantallas de siempre (editar el registro / quitar la alerta).
const SOURCES = ["contact_messages", "prospectos", "property_alerts", "agenda_citas", "property_visits", "property_holds", "clients"];

// Un renglón corto para reconocer cada registro sin mostrar todo el expediente.
function rowLabel(table, row) {
  const parts = [row.name || row.contact_name || row.prospect_name || row.buyer_name, row.phone || row.contact_phone || row.prospect_phone || row.buyer_phone, row.email || row.contact_email, row.titulo];
  return parts.filter(Boolean).join(" · ") || row.id;
}

export default function AdminArco() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [requests, setRequests] = useState(null);

  const loadRequests = () =>
    db
      .getArcoRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  useEffect(() => {
    loadRequests();
  }, []);

  const search = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone(null);
    setResult(null);
    try {
      const q = query.trim();
      setResult(await db.arcoSearch(q));
      setSearched(q);
    } catch (err) {
      setError(err.message || t("arco.error"));
    } finally {
      setBusy(false);
    }
  };

  const total = result ? SOURCES.reduce((n, s) => n + (result[s]?.filas?.length || 0), 0) : 0;
  const erasable = result ? SOURCES.reduce((n, s) => n + (result[s]?.accion === "retain" ? 0 : result[s]?.filas?.length || 0), 0) : 0;

  const download = async () => {
    setBusy(true);
    try {
      // Al descargar sí se deja constancia de la solicitud de acceso.
      const data = await db.arcoSearch(searched, { record: true });
      const blob = new Blob([JSON.stringify({ solicitud: "Acceso (ARCO)", generado: new Date().toISOString(), datos: data }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ARCO_acceso_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      loadRequests();
    } catch (err) {
      notify(err.message || t("arco.error"));
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (!(await confirmDialog(t("arco.confirm", { count: erasable })))) return;
    setBusy(true);
    try {
      setDone(await db.arcoCancel(searched));
      setResult(null);
      loadRequests();
    } catch (err) {
      notify(err.message || t("arco.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("arco.title")}</h1>
          <p className="form-hint">{t("arco.subtitle")}</p>
        </div>
      </div>

      <form className="card" onSubmit={search} style={{ marginBottom: "1.25rem" }}>
        <div className="form-field">
          <label htmlFor="arco-q">{t("arco.queryLabel")}</label>
          <input id="arco-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("arco.queryPlaceholder")} autoComplete="off" />
          <span className="form-hint">{t("arco.queryHint")}</span>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || query.trim().length < 5}>
          {busy ? <span className="spinner" /> : null}
          {t("arco.search")}
        </button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}

      {done && (
        <div className="card" role="status">
          <h2>{t("arco.doneTitle")}</h2>
          <ul>
            {Object.entries(done).map(([key, n]) => (
              <li key={key}>
                {t(`arco.sources.${key}`, { defaultValue: key })}: {n}
              </li>
            ))}
          </ul>
          <p className="form-hint">{t("arco.doneNote")}</p>
        </div>
      )}

      {result && (
        <div className="card">
          <h2>{t("arco.resultsTitle", { count: total })}</h2>
          {total === 0 && <p>{t("arco.none")}</p>}
          {SOURCES.filter((s) => result[s]?.filas?.length).map((s) => (
            <section key={s} style={{ marginBottom: "1rem" }}>
              <h3>
                {t(`arco.sources.${s}`)} ({result[s].filas.length})
                <span className={`badge ${result[s].accion === "retain" ? "badge-reserved" : "badge-sold"}`} style={{ marginLeft: "0.5rem" }}>
                  {t(`arco.action.${result[s].accion}`)}
                </span>
              </h3>
              <ul>
                {result[s].filas.slice(0, 20).map((row) => (
                  <li key={row.id}>{rowLabel(s, row)}</li>
                ))}
                {result[s].filas.length > 20 && <li>{t("arco.andMore", { count: result[s].filas.length - 20 })}</li>}
              </ul>
            </section>
          ))}
          {total > 0 && (
            <div className="admin-actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-outline" onClick={download} disabled={busy}>
                {t("arco.download")}
              </button>
              {erasable > 0 && (
                <button type="button" className="btn btn-danger" onClick={erase} disabled={busy}>
                  {t("arco.erase", { count: erasable })}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2>{t("arco.historyTitle")}</h2>
        {requests === null ? (
          <LoadingState />
        ) : requests.length === 0 ? (
          <p className="form-hint">{t("arco.historyEmpty")}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("arco.when")}</th>
                <th>{t("arco.kind")}</th>
                <th>{t("arco.who")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString(i18n.language)}</td>
                  <td>{t(`arco.kinds.${r.kind}`, { defaultValue: r.kind })}</td>
                  <td>{r.performed_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
