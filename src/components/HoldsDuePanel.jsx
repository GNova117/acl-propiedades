import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatMXN } from "../lib/format";
import { holdsNeedingAttention } from "../lib/offers";
import "./MyDayPanels.css";

// «Apartados por vencer» (Mi día): apartados vigentes que vencen en 3 días o menos, o que ya vencieron. Cada asesor
// ve los suyos; la oficina todos. Quien lo muestra ya comprobó que el rol tiene el apartado Propiedades.
export default function HoldsDuePanel({ advisorId, propertyTitle }) {
  const { t, i18n } = useTranslation();
  const [holds, setHolds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    db.getPropertyHolds()
      .then((rows) => !cancelled && setHolds(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const due = useMemo(() => holdsNeedingAttention(holds.filter((h) => advisorId == null || h.advisor_id === advisorId)), [holds, advisorId]);
  if (due.length === 0) return null;

  return (
    <section className="card day-panel" aria-labelledby="holds-due-title">
      <h2 id="holds-due-title">
        {t("holdsDue.title")} <span className="my-day__count">{due.length}</span>
      </h2>
      <p className="form-hint">{t("holdsDue.hint")}</p>
      <ul className="day-panel__list day-panel__list--plain">
        {due.map(({ hold, state, daysLeft }) => (
          <li key={hold.id} className="day-panel__match">
            <strong>{propertyTitle(hold.property_id) || t("holdsDue.property")}</strong>
            <span className="form-hint">
              {hold.buyer_name} · {formatMXN(hold.amount)} · {new Date(`${hold.due_date}T00:00:00`).toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { day: "numeric", month: "short" })}
            </span>
            <span className={`prospect-chip prospect-chip--${state === "vencido" ? "overdue" : "today"}`}>
              {state === "vencido" ? t("offers.hold.overdue", { count: Math.abs(daysLeft) }) : daysLeft === 0 ? t("offers.hold.dueToday") : t("offers.hold.dueSoon", { count: daysLeft })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
