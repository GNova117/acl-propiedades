import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePendingToday } from "../lib/usePendingToday";
import "./PendingToday.css";

// "Pendientes de hoy" del Panel principal: junta en un solo lugar lo que pide
// atención, mirando solo los apartados que el rol tiene. Todo se calcula con
// datos que ya existen (mensajes, agenda, visitas, Secretaría, prospectos).
export default function PendingToday() {
  const { t } = useTranslation();
  const { items, sectionsKey } = usePendingToday();

  if (items === null || (items.length === 0 && sectionsKey === "false,false,false,false,false,false,false")) return null;

  return (
    <section className="pending-today" aria-label={t("pending.title")}>
      <h2 className="pending-today__title">{t("pending.title")}</h2>
      {items.length === 0 ? (
        <p className="form-hint">{t("pending.allClear")}</p>
      ) : (
        <div className="pending-today__grid">
          {items.map((item) => (
            <Link key={item.key} to={item.to} className={`card pending-item${item.tone ? ` pending-item--${item.tone}` : ""}`}>
              <span className="pending-item__count">{item.count}</span>
              <span className="pending-item__label">{t(`pending.items.${item.key}`)}</span>
              {item.note && <span className="pending-item__note">{item.note}</span>}
              {item.lines.map((line, i) => (
                <span key={i} className="pending-item__line">
                  {line}
                </span>
              ))}
              {item.count > item.lines.length && item.lines.length > 0 && (
                <span className="pending-item__line">{t("pending.andMore", { count: item.count - item.lines.length })}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
