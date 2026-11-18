import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Seo from "../../components/Seo";
import LoadingState from "../../components/LoadingState";
import { db } from "../../lib/dataStore";
import { confirmDialog, notify } from "../../lib/toast";

const STATUSES = ["nuevo", "resuelto", "ignorado"];

// Errores del navegador agrupados (ver lib/errorReporter.js): cuántas veces pasó, dónde y con qué versión.
export default function AdminErrors() {
  const { t, i18n } = useTranslation();
  const [errors, setErrors] = useState(null);
  const [filter, setFilter] = useState("nuevo");
  const [kind, setKind] = useState("todos"); // todos | automatico | usuario
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      setErrors(await db.getClientErrors());
    } catch {
      setErrors([]);
      notify(t("errors.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (errors || []).filter((e) => e.status === s).length])), [errors]);
  const matchesKind = (e) => kind === "todos" || (kind === "usuario" ? e.source === "usuario" : e.source !== "usuario");
  const shown = (errors || []).filter((e) => e.status === filter && matchesKind(e));

  const setStatus = async (error, status) => {
    try {
      await db.setClientErrorStatus(error.id, status);
      await load();
    } catch (err) {
      notify(err?.message || t("errors.updateError"));
    }
  };

  const remove = async (error) => {
    if (!(await confirmDialog(t("errors.deleteConfirm"), { destructive: true }))) return;
    try {
      await db.deleteClientError(error.id);
      await load();
    } catch (err) {
      notify(err?.message || t("errors.updateError"));
    }
  };

  if (!errors) return <LoadingState />;
  const when = (iso) => new Date(iso).toLocaleString(i18n.language);

  return (
    <div className="admin-errors">
      <Seo title={t("errors.title")} noindex />
      <div className="admin-header">
        <div>
          <h1>{t("errors.title")}</h1>
          <p className="form-hint">{t("errors.subtitle")}</p>
        </div>
      </div>

      <div className="admin-errors__filters" role="tablist" aria-label={t("errors.filterLabel")}>
        {STATUSES.map((status) => (
          <button key={status} type="button" role="tab" aria-selected={filter === status} className={`btn btn-sm ${filter === status ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(status)}>
            {t(`errors.status.${status}`)} ({counts[status]})
          </button>
        ))}
      </div>

      <div className="admin-errors__filters" role="group" aria-label={t("errors.kindLabel")}>
        {["todos", "automatico", "usuario"].map((value) => (
          <button key={value} type="button" aria-pressed={kind === value} className={`btn btn-sm ${kind === value ? "btn-primary" : "btn-outline"}`} onClick={() => setKind(value)}>
            {t(`errors.kind.${value}`)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="card admin-errors__empty">{t(filter === "nuevo" ? "errors.emptyNew" : "errors.empty")}</p>
      ) : (
        <ul className="admin-errors__list">
          {shown.map((error) => (
            <li key={error.id} className="card admin-errors__item">
              <div className="admin-errors__head">
                <strong>{error.message}</strong>
                {error.source === "usuario" ? (
                  <span className="admin-errors__who">{t("errors.reportedBy", { email: error.reported_by || t("errors.unknownPerson") })}</span>
                ) : (
                  <span className="admin-errors__count" title={t("errors.times", { count: error.count })}>×{error.count}</span>
                )}
              </div>
              <p className="form-hint">
                {error.url || "/"} · {t("errors.lastSeen", { when: when(error.last_seen) })}
                {error.release ? ` · ${t("errors.release", { release: error.release })}` : ""} · {t(`errors.source.${error.source}`, { defaultValue: error.source })}
              </p>
              {open === error.id && (
                <div>
                  {error.source !== "usuario" && <pre className="admin-errors__stack">{error.stack || t("errors.noStack")}</pre>}
                  {error.user_agent && <p className="form-hint">{error.user_agent}</p>}
                </div>
              )}
              <div className="admin-errors__actions">
                <button type="button" className="btn btn-outline btn-sm" aria-expanded={open === error.id} onClick={() => setOpen(open === error.id ? null : error.id)}>
                  {open === error.id ? t("errors.hideDetail") : t("errors.showDetail")}
                </button>
                {error.status !== "resuelto" && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(error, "resuelto")}>{t("errors.resolve")}</button>}
                {error.status !== "ignorado" && <button type="button" className="btn btn-outline btn-sm" onClick={() => setStatus(error, "ignorado")}>{t("errors.ignore")}</button>}
                {error.status !== "nuevo" && <button type="button" className="btn btn-outline btn-sm" onClick={() => setStatus(error, "nuevo")}>{t("errors.reopen")}</button>}
                <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={() => remove(error)}>{t("errors.delete")}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
