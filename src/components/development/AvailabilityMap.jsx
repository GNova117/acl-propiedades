import { useTranslation } from "react-i18next";
import { groupUnitsByFloor, UNIT_STATUSES } from "../../lib/developments";
import { formatMXN } from "../../lib/format";
import "./development.css";

// "Fachada" de la torre: un renglón por piso (el más alto arriba) y un cuadro
// por departamento, pintado según su estatus. Es lo más rápido para que un
// comprador vea qué queda y en qué nivel; tocar un cuadro abre su ficha.
export default function AvailabilityMap({ development, selected, onSelect }) {
  const { t } = useTranslation();
  const floors = groupUnitsByFloor(development.units || []);
  const columns = Math.max(1, ...floors.map((f) => f.units.length));
  const modelName = new Map((development.models || []).map((m) => [m.key, m.name]));

  return (
    <div className="dev-map">
      <ul className="dev-map__legend" aria-label={t("developments.sections.availability")}>
        {UNIT_STATUSES.map((status) => (
          <li key={status}>
            <span className={`dev-map__swatch dev-map__swatch--${status}`} aria-hidden="true" />
            {t(`developments.legend.${status}`)}
          </li>
        ))}
      </ul>

      <div className="dev-map__building" style={{ "--dev-map-columns": columns }}>
        {floors.map(({ floor, units }) => (
          <div key={floor} className="dev-map__row">
            <span className="dev-map__floor">{t("developments.floorLabel", { floor })}</span>
            <div className="dev-map__cells">
              {units.map((unit) => {
                const span = Math.max(1, Math.floor(columns / units.length));
                const label = `${t("developments.unit.title", { number: unit.number })}, ${t("developments.unit.floor", { floor: unit.floor })}, ${
                  modelName.get(unit.model) || unit.model
                }, ${t(`developments.legend.${unit.status}`)}, ${formatMXN(unit.price)}`;
                return (
                  <button
                    key={unit.number}
                    type="button"
                    className={`dev-map__cell dev-map__cell--${unit.status} ${selected === unit.number ? "dev-map__cell--selected" : ""}`}
                    style={{ gridColumn: `span ${span}` }}
                    onClick={() => onSelect(unit.number)}
                    aria-label={label}
                    title={label}
                  >
                    <span className="dev-map__number">{unit.number}</span>
                    <span className="dev-map__model">{modelName.get(unit.model) || unit.model}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
