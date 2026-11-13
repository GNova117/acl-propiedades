import { useState } from "react";
import { useTranslation } from "react-i18next";

// Filtros de una lista del panel (Propiedades, Clientes). En pantalla ancha son
// una tarjeta con todos los campos a la vista; en el teléfono solo queda la
// búsqueda y un botón «Filtros (N)» que despliega el resto, para que la lista
// empiece en la primera pantalla y no después de seis selectores. Es solo CSS
// (ver .admin-filters en admin.css): el mismo marcado sirve para los dos casos.
// `search`: el campo de búsqueda, siempre visible; `activeCount`: cuántos de los
// filtros plegados están puestos (se muestra en el botón); `children`: el resto.
export default function AdminFilters({ search, activeCount = 0, children }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className={`card admin-filters${open ? " is-open" : ""}`}>
      {search}
      <button type="button" className="btn btn-outline admin-filters__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t("properties.filters")}
        {activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <div className="admin-filters__more">{children}</div>
    </div>
  );
}
