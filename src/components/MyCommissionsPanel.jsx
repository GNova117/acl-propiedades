import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../lib/format";
import { summarizeByAdvisor } from "../lib/commissions";
import { queries } from "../lib/queries";
import { useQuery } from "../lib/useQuery";
import "./MyDayPanels.css";

// «Mis comisiones» (Mi día, solo para un asesor): lo que tiene pendiente y lo que ya le pagaron. La base solo le entrega
// las suyas (RLS); aun así se filtra por su asesor. Sin ninguna comisión registrada no se muestra.
export default function MyCommissionsPanel({ advisorId }) {
  const { t } = useTranslation();
  const commissionsQ = useQuery(queries.commissions, { enabled: Boolean(advisorId) });
  const mine = useMemo(() => (commissionsQ.data ?? []).filter((c) => c.advisor_id === advisorId), [commissionsQ.data, advisorId]);
  if (!advisorId || mine.length === 0) return null;
  const [totals] = summarizeByAdvisor(mine);
  const lastPaid = mine.filter((c) => c.status === "pagada").sort((a, b) => String(b.paid_on).localeCompare(String(a.paid_on)))[0];

  return (
    <section className="card day-panel" aria-labelledby="my-commissions-title">
      <h2 id="my-commissions-title">{t("commissions.mineTitle")}</h2>
      <p>
        <strong>{t("commissions.owed", { amount: formatMXN(totals.pending) })}</strong>
      </p>
      <p className="form-hint">
        {t("commissions.paidTotal", { amount: formatMXN(totals.paid) })}
        {lastPaid ? ` · ${t("commissions.lastPaid", { date: lastPaid.paid_on })}` : ""}
      </p>
    </section>
  );
}
