import { useTranslation } from "react-i18next";

// «Más» de una fila o tarjeta de lista: deja a la vista las acciones de todos
// los días y guarda las demás —y lo destructivo, como eliminar— tras un toque.
// Es un <details> nativo y se despliega dentro de la propia fila (un menú
// flotante se recortaría dentro de la tabla con scroll). Se cierra al elegir una acción.
export default function RowMore({ children, label }) {
  const { t } = useTranslation();
  return (
    <details className="row-more">
      <summary className="btn btn-outline btn-sm">{label || t("common.more")}</summary>
      <div
        className="row-more__panel"
        onClick={(e) => {
          if (e.target.closest("a, button")) e.currentTarget.closest("details").open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
