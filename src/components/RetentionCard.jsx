import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatLinkDate } from "./LinkExpiry";

// Regla del negocio: la papelería de los clientes se conserva 3 años desde la última actividad y después se depura (ver la
// migración 0123 y la función depurar-papeleria). Esta tarjeta (Roles y accesos) muestra cuánto ya cumplió el plazo y qué pasó en la
// última corrida. La depuración arranca como SIMULACRO: solo cuenta; borra de verdad cuando se activa RETENTION_PURGE_ENABLED.
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

  if (!summary) return null;
  const last = summary.last_run;

  return (
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
  );
}
