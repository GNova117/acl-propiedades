import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatMXN } from "../lib/format";
import { commissionLines } from "../lib/commissions";
import "./CommissionsCard.css";
import { confirmDialog } from "../lib/toast";

const errorText = (t, err) => {
  const match = /^commission:(\w+)$/.exec(String(err?.message || ""));
  return match ? t(`commissions.errors.${match[1]}`, { defaultValue: t("commissions.errors.generic") }) : t("commissions.errors.generic");
};

// «Comisiones por asesor» de la liquidación de una propiedad: las que salen del cálculo de arriba (captación y venta),
// cada una con su estado (pendiente o pagada) y su fecha de pago. «Registrar» guarda el monto de ese momento (una foto:
// si después cambia el cálculo, se ve la diferencia y se puede actualizar mientras siga pendiente); una pagada ya no
// se toca. Solo los socios las manejan (RLS); es el mismo grupo que ve la liquidación.
export default function CommissionsCard({ propertyId, breakdown, captadorId, vendedorId, advisors }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [payDate, setPayDate] = useState({});
  const today = new Date().toLocaleDateString("en-CA");

  const load = useCallback(() => db.getCommissions(propertyId).then(setRows).catch(() => setRows([])), [propertyId]);
  useEffect(() => {
    load();
  }, [load]);

  const lines = useMemo(() => commissionLines(breakdown, { captadorId, vendedorId }), [breakdown, captadorId, vendedorId]);
  const name = (id) => advisors.find((a) => a.id === id)?.name || "—";
  const registered = (concept) => rows.find((r) => r.concept === concept);

  const run = async (key, fn) => {
    setBusyKey(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusyKey("");
    }
  };

  // Una comisión registrada que ya no sale en el cálculo (p. ej. cambió el vendedor) también se muestra.
  const concepts = ["captacion", "venta"].filter((c) => lines.some((l) => l.concept === c) || registered(c));

  return (
    <div className="card commissions-card">
      <h2>{t("commissions.title")}</h2>
      <p className="form-hint">{t("commissions.hint")}</p>
      {concepts.length === 0 ? (
        <p className="form-hint">{t("commissions.none")}</p>
      ) : (
        <ul className="commissions-card__list">
          {concepts.map((concept) => {
            const line = lines.find((l) => l.concept === concept);
            const row = registered(concept);
            const paid = row?.status === "pagada";
            const changed = row && line && !paid && (Number(row.amount) !== line.amount || row.advisor_id !== line.advisor_id);
            return (
              <li key={concept} className="commissions-card__item">
                <div>
                  <strong>{t(`commissions.concepts.${concept}`)}</strong> · {name(row?.advisor_id || line?.advisor_id)} ·{" "}
                  <strong>{formatMXN(row ? row.amount : line.amount)}</strong>{" "}
                  {row && <span className={`prospect-chip${paid ? "" : " prospect-chip--today"}`}>{paid ? t("commissions.paidOn", { date: row.paid_on }) : t("commissions.pending")}</span>}
                  {changed && <p className="form-hint">{t("commissions.changed", { amount: formatMXN(line.amount), name: name(line.advisor_id) })}</p>}
                </div>
                <div className="commissions-card__actions">
                  {line && !paid && (!row || changed) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busyKey === concept}
                      onClick={() => run(concept, () => db.saveCommission(propertyId, { advisor_id: line.advisor_id, concept, amount: line.amount }))}
                    >
                      {row ? t("commissions.update") : t("commissions.register")}
                    </button>
                  )}
                  {row && !paid && (
                    <>
                      <input
                        type="date"
                        max={today}
                        value={payDate[concept] ?? today}
                        onChange={(e) => setPayDate((d) => ({ ...d, [concept]: e.target.value }))}
                        aria-label={t("commissions.payDate")}
                      />
                      <button type="button" className="btn btn-primary btn-sm" disabled={busyKey === row.id} onClick={() => run(row.id, () => db.setCommissionPaid(row.id, payDate[concept] ?? today))}>
                        {t("commissions.markPaid")}
                      </button>
                    </>
                  )}
                  {paid && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={busyKey === row.id} onClick={async () => await confirmDialog(t("commissions.confirmUndo")) && run(row.id, () => db.setCommissionPaid(row.id, null))}>
                      {t("commissions.undoPaid")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
