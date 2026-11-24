import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { contractsNeedingAttention } from "../lib/contracts";
import { queries } from "../lib/queries";
import { useQuery } from "../lib/useQuery";
import "./MyDayPanels.css";

// «Exclusivas por vencer» (Mi día): contratos de intermediación que vencen en 30 días o menos, o que ya vencieron.
// Quien lo muestra ya comprobó que el rol tiene el apartado Propiedades. Se renueva (o se quita) desde «Contrato» en
// Propiedades.
export default function ContractsDuePanel({ propertyTitle }) {
  const { t } = useTranslation();
  const contractsQ = useQuery(queries.propertyContracts);
  const due = useMemo(() => contractsNeedingAttention(contractsQ.data ?? []), [contractsQ.data]);
  if (due.length === 0) return null;

  return (
    <section className="card day-panel" aria-labelledby="contracts-due-title">
      <h2 id="contracts-due-title">
        {t("contractsDue.title")} <span className="my-day__count">{due.length}</span>
      </h2>
      <p className="form-hint">{t("contractsDue.hint")}</p>
      <ul className="day-panel__list day-panel__list--plain">
        {due.map(({ contract, state, daysLeft }) => (
          <li key={contract.property_id} className="day-panel__match">
            <strong>{propertyTitle(contract.property_id) || t("holdsDue.property")}</strong>
            <span className="form-hint">{t(`contract.kinds.${contract.kind}`)}</span>
            <span className={`prospect-chip prospect-chip--${state === "vencido" ? "overdue" : "today"}`}>{t(`contract.states.${state}`, { count: Math.abs(daysLeft) })}</span>
          </li>
        ))}
      </ul>
      <Link to="/admin/propiedades" className="btn btn-outline btn-sm">
        {t("contractsDue.open")}
      </Link>
    </section>
  );
}
