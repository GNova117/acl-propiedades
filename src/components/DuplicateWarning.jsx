import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./DuplicateWarning.css";

// Aviso "este contacto ya existe" antes de guardar un prospecto nuevo
// (find_contact_duplicates / lib/duplicates.js). No bloquea: quien guarda decide
// si es otra persona o si abre el que ya existe. Del prospecto de otro asesor
// solo se muestra quién lo lleva (no hay enlace: no se puede abrir).
export default function DuplicateWarning({ duplicates, onOpen }) {
  const { t } = useTranslation();
  if (!duplicates?.length) return null;

  return (
    <div className="duplicate-warning" role="alert">
      <strong>{t("duplicates.title")}</strong>
      <ul>
        {duplicates.map((d, i) => {
          const what =
            d.kind === "client"
              ? t("duplicates.client")
              : t("duplicates.prospect", { stage: t(`prospects.stages.${d.stage}`) });
          const detail = [what, d.kind === "prospect" && !d.mine ? t("duplicates.ofAdvisor", { name: d.advisor_name || "—" }) : null, t(`duplicates.matched.${d.matched}`)]
            .filter(Boolean)
            .join(" · ");
          const to = d.id ? (d.kind === "client" ? `/admin/clientes/${d.id}` : `/admin/prospectos/${d.id}`) : null;
          return (
            <li key={`${d.kind}-${d.id || i}`}>
              <strong>{d.name}</strong> <span className="form-hint">{detail}</span>
              {to && (
                <Link to={to} className="btn btn-outline btn-sm" onClick={onOpen}>
                  {t("duplicates.open")}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <p className="form-hint">{t("duplicates.hint")}</p>
    </div>
  );
}
