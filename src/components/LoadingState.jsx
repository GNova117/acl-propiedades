import { useTranslation } from "react-i18next";
import "./LoadingState.css";

const BAR_WIDTHS = ["72%", "94%", "58%", "86%"];

// Siluetas de carga en lugar del texto «Cargando…»: la pantalla ya tiene la forma de lo que va a llegar y no «salta» al
// llegarle los datos. Un solo componente con unas pocas formas:
//   page  — un título y unos bloques (pantalla de detalle o de formulario; el valor por omisión)
//   lines — unos renglones (una sección que carga dentro de una tarjeta)
//   rows  — filas de tabla o de lista (`count` filas)
//   cards — una rejilla de tarjetas (`count` tarjetas)
//   block — un solo bloque de la altura `height` (px o %), para el lugar de un mapa que carga
// Siempre lleva el aviso «Cargando…» para lectores de pantalla (role="status"); las siluetas son solo decoración.
// `tall`: para páginas LARGAS que cargan sus datos (la ficha de una propiedad): ocupa más que la pantalla para que el pie de
// página no esté a la vista mientras carga; si lo estuviera, al llegar el contenido saltaría hacia abajo (desplazamiento de diseño
// de 0.56 medido con Lighthouse) y la página «brincaría» frente a la persona.
export default function LoadingState({ variant = "page", count, height, tall = false }) {
  const { t } = useTranslation();
  const n = count ?? (variant === "cards" ? 6 : variant === "rows" ? 4 : 3);
  return (
    <div className={`loading-state loading-state--${variant}${tall ? " loading-state--tall" : ""}`} role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{t("common.loading")}</span>
      <div aria-hidden="true" className="loading-state__shapes">
        {variant === "page" && (
          <>
            <span className="skeleton skeleton--title" />
            <span className="skeleton skeleton--block" />
            <span className="skeleton skeleton--block skeleton--short" />
          </>
        )}
        {variant === "lines" && Array.from({ length: n }, (_, i) => <span key={i} className="skeleton skeleton--line" style={{ width: BAR_WIDTHS[i % BAR_WIDTHS.length] }} />)}
        {variant === "rows" && Array.from({ length: n }, (_, i) => <span key={i} className="skeleton skeleton--row" />)}
        {variant === "block" && <span className="skeleton skeleton--fill" style={{ height }} />}
        {variant === "cards" && Array.from({ length: n }, (_, i) => <span key={i} className="skeleton skeleton--card" />)}
      </div>
    </div>
  );
}
