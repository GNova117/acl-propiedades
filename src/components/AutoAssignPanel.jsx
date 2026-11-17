import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { groupPlan, planAssignments } from "../lib/assignAdvisor";
import { applyBulk } from "../lib/prospectBulk";
import "./AutoAssignPanel.css";

const MAX_SHOWN = 30;

// «Asignar automáticamente» (Equipo hoy, solo la oficina): propone un asesor para cada prospecto abierto que no tiene
// dueño, con las reglas de lib/assignAdvisor.js (la propiedad que le interesa y, si no, quien menos carga tiene), y
// NO guarda nada hasta que se confirma. `onApplied(registros)`: los prospectos ya actualizados.
export default function AutoAssignPanel({ prospects, advisors, properties, onApplied, onClose }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const plan = useMemo(() => planAssignments(prospects, { advisors, properties }), [prospects, advisors, properties]);

  const apply = async () => {
    setBusy(true);
    setMessage("");
    let assigned = 0;
    let failed = 0;
    const updatedAll = [];
    try {
      // Un asesor a la vez y cada prospecto uno por uno (ver applyBulk).
      for (const group of groupPlan(plan)) {
        const { updated, failed: bad } = await applyBulk(db, group.prospects, "advisor", group.advisor.id);
        assigned += updated.length;
        failed += bad;
        updatedAll.push(...updated);
      }
      if (updatedAll.length > 0) onApplied(updatedAll);
      setMessage(failed > 0 ? t("autoAssign.partial", { done: assigned, failed }) : t("autoAssign.done", { count: assigned }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card auto-assign" aria-labelledby="auto-assign-title">
      <div className="auto-assign__head">
        <h2 id="auto-assign-title">{t("autoAssign.title")}</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
      <p className="form-hint">{t("autoAssign.hint")}</p>

      {plan.length === 0 ? (
        <p className="form-hint">{message || t("autoAssign.nothing")}</p>
      ) : (
        <>
          <ul className="auto-assign__list">
            {plan.slice(0, MAX_SHOWN).map(({ prospect, advisor, reason }) => (
              <li key={prospect.id}>
                <span>{prospect.name}</span>
                <span aria-hidden="true">→</span>
                <strong>{advisor.name}</strong>
                <span className="prospect-chip">{t(`autoAssign.reason.${reason}`)}</span>
              </li>
            ))}
          </ul>
          {plan.length > MAX_SHOWN && <p className="form-hint">{t("autoAssign.more", { count: plan.length - MAX_SHOWN })}</p>}
          <div className="auto-assign__actions">
            <button type="button" className="btn btn-primary" onClick={apply} disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {t("autoAssign.apply", { count: plan.length })}
            </button>
          </div>
          {message && <p className="form-hint" role="status">{message}</p>}
        </>
      )}
    </section>
  );
}
