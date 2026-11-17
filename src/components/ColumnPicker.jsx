import { useTranslation } from "react-i18next";

// «Columnas»: casillas para mostrar u ocultar columnas de una tabla del panel. `columns`: [{ key, label }] (solo las que
// se pueden ocultar; las demás —nombre, acciones— siempre se ven); `hidden`: Set de las ocultas; `onToggle(key)`.
export default function ColumnPicker({ columns, hidden, onToggle, onReset }) {
  const { t } = useTranslation();
  return (
    <details className="column-picker">
      <summary className="btn btn-outline btn-sm">
        {t("tableTools.columns")}
        {hidden.size > 0 ? ` (${columns.length - hidden.size}/${columns.length})` : ""}
      </summary>
      <div className="column-picker__panel card">
        {columns.map((column) => (
          <label key={column.key} className="column-picker__option">
            <input type="checkbox" checked={!hidden.has(column.key)} onChange={() => onToggle(column.key)} />
            {column.label}
          </label>
        ))}
        {hidden.size > 0 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onReset}>
            {t("tableTools.showAll")}
          </button>
        )}
      </div>
    </details>
  );
}
