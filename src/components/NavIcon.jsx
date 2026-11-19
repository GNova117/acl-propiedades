// Iconos del menú lateral del panel (qué icono lleva cada ruta: lib/navIcons.js): trazos sencillos (24×24, sin relleno) que heredan el color del texto. Son
// decorativos (aria-hidden): el nombre de cada apartado sigue siendo el texto, que en el modo compacto se oculta a la
// vista pero no a los lectores de pantalla.
const PATHS = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  today: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  user: "M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c0-4 4-6 8-6s8 2 8 6",
  users: "M9 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2 20c0-3.5 3.5-5.5 7-5.5s7 2 7 5.5M17 5a3 3 0 010 6M19 14.5c2 .6 3 2.2 3 4.5",
  home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  building: "M4 21V5l8-3 8 3v16M9 21v-4h6v4M9 8h2M13 8h2M9 12h2M13 12h2",
  factory: "M3 21V10l6 4v-4l6 4V6h6v15zM7 17h2M12 17h2M17 17h2",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  briefcase: "M3 7h18v13H3zM9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18",
  chat: "M21 12a8 8 0 01-11.5 7.2L3 21l1.8-5.5A8 8 0 1121 12z",
  star: "M12 2l3 7 7 .5-5.2 4.7L18.5 22 12 18l-6.5 4 1.7-7.8L2 9.5 9 9z",
  pen: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  wallet: "M3 6h18v14H3zM3 10h18M16 15h2",
  calculator: "M5 2h14v20H5zM8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01",
  clipboard: "M6 4h12v17H6zM9 4V3h6v1M9 11h6M9 15h6",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5",
  hammer: "M14 5l5 5-2 2-5-5zM12 7L4 15l3 3 8-8",
  box: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  key: "M8 11a4 4 0 100 8 4 4 0 000-8zM10.8 12.2L20 3M16 7l3 3",
  landmark: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18",
  history: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  megaphone: "M3 11v2a1 1 0 001 1h2l7 4V6L6 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8",
  bell: "M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4",
  help: "M12 2a10 10 0 100 20 10 10 0 000-20zM9.5 9a2.5 2.5 0 114 2c-1 .8-1.5 1.2-1.5 2.5M12 17h.01",
  pin: "M12 17v5M8 3h8l-1 7 3 4H6l3-4z",
};

export default function NavIcon({ name, className = "" }) {
  const d = PATHS[name] || PATHS.dashboard;
  return (
    <svg className={`nav-icon ${className}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
