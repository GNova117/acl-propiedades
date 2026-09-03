const ICONS = {
  casa: (
    <path d="M3 11.5 12 4l9 7.5M5.5 9.8V20h5v-6h3v6h5V9.8" />
  ),
  departamento: (
    <path d="M4 21V4h10v17M14 9h6v12M7 8h1M7 12h1M7 16h1M11 8h1M11 12h1M11 16h1M17 12h1M17 16h1" />
  ),
  nave_industrial: (
    <path d="M3 21V11l5 3v-3l5 3v-3l5 3v7H3ZM6 21v-5M12 21v-5M18 21v-5" />
  ),
  terreno: (
    <path d="M3 20h18M5 20V8h14v12M9 8V4h2v4M13 8V4h2v4" />
  ),
};

export default function PropertyTypeIcon({ type, size = 22, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {ICONS[type] || ICONS.casa}
    </svg>
  );
}
