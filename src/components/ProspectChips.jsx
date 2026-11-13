import { useTranslation } from "react-i18next";
import { followUpState, unattendedAge, unattendedState } from "../lib/prospects";

// Prospecto que llegó solo y nadie ha contactado: amarillo desde la primera
// hora, rojo desde las 4.
export function UnattendedChip({ prospect }) {
  const { t } = useTranslation();
  const state = unattendedState(prospect);
  if (!state) return null;
  const age = unattendedAge(state.hours);
  return <span className={`prospect-chip prospect-chip--${state.level === "late" ? "overdue" : "today"}`}>{t(`prospects.unattended.${age.unit}`, { count: age.count })}</span>;
}

// Seguimiento vencido, de hoy o programado (solo en etapas abiertas).
export function FollowChip({ prospect }) {
  const { t } = useTranslation();
  const state = followUpState(prospect);
  if (state === "overdue") return <span className="prospect-chip prospect-chip--overdue">{t("prospects.followOverdue")}</span>;
  if (state === "today") return <span className="prospect-chip prospect-chip--today">{t("prospects.followToday")}</span>;
  if (prospect.next_followup_at && prospect.stage !== "cerrado" && prospect.stage !== "perdido") {
    return (
      <span className="prospect-chip">
        {t("prospects.followOn", { date: new Date(`${prospect.next_followup_at}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) })}
      </span>
    );
  }
  return null;
}
