import "./Logo.css";

const MARK_ID_PREFIX = "acl-logo-grad";

/**
 * Brand lockup for ACL Propiedades: geometric roof/arrow mark + "ACL" wordmark
 * + "PROPIEDADES" tagline with a double underline, mirroring the supplied brand art.
 * variant controls the color treatment for use on light headers, dark footers, etc.
 */
export default function Logo({ variant = "color", size = "md", showTagline = true, className = "" }) {
  const gradId = `${MARK_ID_PREFIX}-${variant}`;
  const isMono = variant === "white" || variant === "black";
  const strokeColor = variant === "white" ? "#ffffff" : variant === "black" ? "#0a0e14" : null;

  return (
    <span className={`acl-logo acl-logo--${size} acl-logo--${variant} ${className}`}>
      <svg viewBox="0 0 60 52" className="acl-logo__mark" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d3b73" />
            <stop offset="100%" stopColor="#2f9bdc" />
          </linearGradient>
        </defs>
        <path
          d="M6 48 L26 4 L34 4 L34 16 L24 16 L14 40 L34 40 L34 30 L44 30 L44 48 Z"
          fill={isMono ? strokeColor : `url(#${gradId})`}
        />
        <path
          d="M34 4 H58 V14 H44 V22 H54 V32 H44 V38 H58 V48 H34 Z"
          fill={isMono ? strokeColor : "#12181f"}
          opacity={isMono ? 1 : 0.92}
        />
      </svg>
      <span className="acl-logo__text">
        <span className="acl-logo__acl">ACL</span>
        {showTagline && (
          <>
            <span className="acl-logo__tagline">PROPIEDADES</span>
            <span className="acl-logo__rule" aria-hidden="true">
              <span />
              <span />
            </span>
          </>
        )}
      </span>
    </span>
  );
}
