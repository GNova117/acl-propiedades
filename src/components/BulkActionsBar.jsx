import { useTranslation } from "react-i18next";
import "./BulkActionsBar.css";

// Barra que aparece arriba de una tabla del admin cuando hay filas
// seleccionadas con checkbox. Solo arma el "N seleccionados" + botón de
// cancelar; las acciones en sí las pasa quien la usa (children), porque
// cambian según la pantalla (Clientes solo borra, Propiedades también
// cambia estatus/activo).
export default function BulkActionsBar({ count, onClear, busy, children }) {
  const { t } = useTranslation();
  if (count === 0) return null;

  return (
    <div className="bulk-actions-bar card">
      <span className="bulk-actions-bar__count">{t("bulkActions.selectedCount", { count })}</span>
      <div className="bulk-actions-bar__actions">{children}</div>
      <button type="button" className="btn btn-outline btn-sm" onClick={onClear} disabled={busy}>
        {t("bulkActions.clearSelection")}
      </button>
    </div>
  );
}
