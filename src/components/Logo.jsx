import { ACL_LOGO_ACCENT_PATH, ACL_LOGO_BASE_PATH } from "../lib/aclLogoPaths";
import "./Logo.css";

/**
 * Brand lockup for ACL Propiedades: the vector artwork supplied by the
 * business (icon + "ACL" wordmark + "PROPIEDADES" tagline + underline, all
 * baked into a single graphic). `variant` controls the color treatment —
 * "color" keeps the brand blue/black (black flips with the site's
 * light/dark theme via --color-text), "white"/"black" force both paths to
 * one flat color for use on backgrounds that don't change with the theme
 * (dark sidebar, dark footer).
 */
export default function Logo({ variant = "color", size = "md", className = "" }) {
  return (
    <svg
      viewBox="0 0 1414 849"
      className={`acl-logo acl-logo--${size} acl-logo--${variant} ${className}`}
      role="img"
      aria-label="ACL Propiedades"
    >
      <path
        className="acl-logo__accent"
        fillRule="evenodd"
        d={ACL_LOGO_ACCENT_PATH}
      />
      <path
        className="acl-logo__base"
        fillRule="evenodd"
        d={ACL_LOGO_BASE_PATH}
      />
    </svg>
  );
}
