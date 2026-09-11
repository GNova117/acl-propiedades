// Estilos en src/index.css (.testimonial-stars) — global, ya se carga una
// vez desde main.jsx, así que no hace falta un CSS propio aquí.
export default function Stars({ rating }) {
  return (
    <span className="testimonial-stars" aria-label={`${rating}/5`}>
      {"★".repeat(rating)}
      <span className="testimonial-stars__empty">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
