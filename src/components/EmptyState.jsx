import "./EmptyState.css";

// Ilustraciones sencillas (trazos en el color de la marca) para las pantallas vacías. Decorativas: el mensaje va en texto.
const ART = {
  search: (
    <>
      <path d="M14 38l18-14 18 14v18H14z" />
      <path d="M26 56V44h12v12" />
      <circle cx="52" cy="22" r="9" />
      <path d="M58.5 28.5L66 36" />
    </>
  ),
  heart: (
    <>
      <path d="M40 62C16 46 12 32 12 24c0-7 5-12 12-12 6 0 12 4 16 10 4-6 10-10 16-10 7 0 12 5 12 12 0 8-4 22-28 38z" />
    </>
  ),
  compare: (
    <>
      <rect x="10" y="18" width="24" height="40" rx="3" />
      <rect x="46" y="18" width="24" height="40" rx="3" strokeDasharray="4 4" />
      <path d="M40 38h0" />
      <path d="M18 28h8M18 36h8M18 44h8" />
    </>
  ),
  document: (
    <>
      <path d="M22 10h24l12 12v46H22z" transform="translate(-4 -2)" />
      <path d="M42 8v14h14" transform="translate(-4 -2)" />
      <path d="M26 40h28M26 48h28M26 56h18" />
    </>
  ),
  signpost: (
    <>
      <path d="M40 10v60" />
      <path d="M40 18h20l6 6-6 6H40z" />
      <path d="M40 38H20l-6 6 6 6h20z" />
      <path d="M30 70h20" />
    </>
  ),
  calendar: (
    <>
      <rect x="12" y="16" width="56" height="48" rx="4" />
      <path d="M12 30h56M26 10v12M54 10v12" />
      <path d="M30 46h20" strokeDasharray="3 4" />
    </>
  ),
};

// Pantalla vacía con ilustración, un título, el motivo y una acción clara (`children` = los botones o enlaces). Conserva la
// clase `empty-state` de siempre. `as`: el nivel del título.
export default function EmptyState({ illustration = "search", title, text, children, className = "", as: Heading = "h2" }) {
  return (
    <div className={`empty-state empty-state--illustrated ${className}`}>
      <svg className="empty-state__art" viewBox="0 0 80 80" width="96" height="96" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {ART[illustration] || ART.search}
      </svg>
      {title && <Heading className="empty-state__title">{title}</Heading>}
      {text && <p className="empty-state__text">{text}</p>}
      {children && <div className="empty-state__actions">{children}</div>}
    </div>
  );
}
