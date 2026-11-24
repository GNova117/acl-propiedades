// Iconos de los datos de una propiedad (recámaras, baños, superficie, estacionamiento) para las tarjetas y la ficha.
// Trazos sencillos de 24×24 que heredan el color del texto; son decorativos (aria-hidden): el dato sigue diciendo
// «3 Recámaras» en texto.
const PATHS = {
  bed: "M3 18v-7a2 2 0 012-2h14a2 2 0 012 2v7M3 18h18M3 14h18M7 9V7a1 1 0 011-1h3a1 1 0 011 1v2",
  bath: "M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4zM6 12V6a2 2 0 013.5-1.3M7 19l-1 2M17 19l1 2",
  area: "M4 4h16v16H4zM4 9h5M4 14h3M9 4v5M14 4v3M20 14h-5M14 20v-5",
  car: "M5 16v-4l2-5h10l2 5v4M3 16h18v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H4a1 1 0 01-1-1zM7.5 13h.01M16.5 13h.01",
};

export default function FactIcon({ name, size = 16, className = "" }) {
  return (
    <svg className={`fact-icon ${className}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] || PATHS.area} />
    </svg>
  );
}
