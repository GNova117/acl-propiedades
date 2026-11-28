import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatLinkDate } from "./LinkExpiry";
import { confirmDialog, notify } from "../lib/toast";

// Regla del negocio: la papelería de los clientes se conserva 3 años desde la última actividad y después se depura (ver la
// migración 0123 y la función depurar-papeleria). Esta tarjeta (Roles y accesos) muestra cuánto ya cumplió el plazo y qué pasó en la
// última corrida. La depuración arranca como SIMULACRO: solo cuenta; borra de verdad cuando se activa RETENTION_PURGE_ENABLED.
// Chats, mensajes, prospectos y contratos (migración 0127): cuánto ya cumplió su plazo y si el borrado está activo o es solo simulacro.
function DataRetention() {
  const { t, i18n } = useTranslation();
  const [rules, setRules] = useState(null);
  const [busy, setBusy] = useState("");

  const load = () =>
    db
      .getDataRetention()
      .then(setRules)
      .catch(() => setRules(null));
  useEffect(() => {
    load();
  }, []);

  if (!rules) return null;

  const toggle = async (rule) => {
    const turnOn = !rule.enabled;
    const ok = await confirmDialog(t(turnOn ? "dataRetention.confirmOn" : "dataRetention.confirmOff", { name: t(`dataRetention.kinds.${rule.kind}`), due: rule.due }));
    if (!ok) return;
    setBusy(rule.kind);
    try {
      await db.setDataRetention(rule.kind, turnOn);
      await load();
    } catch (err) {
      notify(err.message || t("dataRetention.error"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
      <h2 className="profiling-section-title">{t("dataRetention.title")}</h2>
      <p className="form-hint">{t("dataRetention.intro")}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("dataRetention.what")}</th>
            <th>{t("dataRetention.rule")}</th>
            <th>{t("dataRetention.due")}</th>
            <th>{t("dataRetention.state")}</th>
            <th>{t("dataRetention.lastRun")}</th>
            <th><span className="visually-hidden-cell">{t("common.actions")}</span></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.kind}>
              <td>{t(`dataRetention.kinds.${rule.kind}`)}</td>
              <td>{t(`dataRetention.periods.${rule.kind}`)}</td>
              <td>{rule.due}</td>
              <td>{t(rule.enabled ? "dataRetention.active" : "dataRetention.dry")}</td>
              <td>
                {rule.last_run
                  ? t("dataRetention.lastRunText", { date: formatLinkDate(rule.last_run.ran_at, i18n.language), due: rule.last_run.due, deleted: rule.last_run.deleted })
                  : t("dataRetention.noRuns")}
              </td>
              <td>
                <button type="button" className={`btn btn-sm ${rule.enabled ? "btn-outline" : "btn-primary"}`} disabled={busy === rule.kind} onClick={() => toggle(rule)}>
                  {t(rule.enabled ? "dataRetention.turnOff" : "dataRetention.turnOn")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RetentionCard() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    db.getRetentionSummary()
      .then((data) => active && setSummary(data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const last = summary?.last_run;

  return (
    <>
    <DataRetention />
    {summary && (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
      <h2 className="profiling-section-title">{t("retention.title")}</h2>
      <p className="form-hint">{t("retention.rule", { years: summary.retention_years })}</p>
      <p>
        {summary.documents > 0
          ? t("retention.due", { documents: summary.documents, clients: summary.clients, date: formatLinkDate(summary.oldest_activity, i18n.language) })
          : t("retention.none")}
      </p>
      <p className="form-hint">
        {last
          ? t(last.dry_run ? "retention.lastDry" : "retention.lastReal", {
              date: formatLinkDate(last.ran_at, i18n.language),
              due: last.documents_due,
              deleted: last.documents_deleted,
              failed: last.files_failed,
            })
          : t("retention.noRuns")}
      </p>
    </div>
    )}
    </>
  );
}
