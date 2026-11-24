import { useTranslation } from "react-i18next";
import { ariaSort } from "../lib/tableTools";

// Encabezado de columna que ordena la tabla al pulsarlo (sin orden → ascendente → descendente → sin orden). Es un botón
// dentro del <th> (se alcanza con Tab) y el <th> lleva aria-sort, así un lector de pantalla dice cómo está ordenada.
// `colProps`: lo que hace falta para poder ocultar la columna (data-col / hidden, ver ColumnPicker).
export default function SortableTh({ column, sort, onSort, children, colProps = {}, className }) {
  const { t } = useTranslation();
  const state = ariaSort(sort, column);
  return (
    <th {...colProps} className={className} aria-sort={state}>
      <button type="button" className="sort-button" onClick={() => onSort(column)} title={t("tableTools.sortBy", { column: typeof children === "string" ? children : "" })}>
        <span>{children}</span>
        <span className={`sort-button__arrow sort-button__arrow--${state}`} aria-hidden="true">
          {state === "ascending" ? "▲" : state === "descending" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}
