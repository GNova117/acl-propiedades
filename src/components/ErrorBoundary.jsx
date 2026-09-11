import { Component } from "react";
import i18n from "../i18n";
import { trackException } from "../lib/analytics";
import "./ErrorBoundary.css";

// Evita que un error de render en una página deje al visitante viendo una
// pantalla en blanco. Se usa por separado en PublicLayout y AdminLayout,
// envolviendo solo el contenido de cada ruta (no el layout completo) —
// así el header/nav siguen funcionando para salir de ahí aunque la
// página en sí haya tronado. Tiene que ser una clase: React todavía no
// tiene equivalente con hooks para getDerivedStateFromError/
// componentDidCatch.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    trackException(error);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(error, info);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const homePath = this.props.homePath || "/";
    return (
      <div className="empty-state error-boundary">
        <p>{i18n.t("errorBoundary.message")}</p>
        <div className="error-boundary__actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {i18n.t("errorBoundary.reload")}
          </button>
          <a href={homePath} className="btn btn-outline">
            {i18n.t("errorBoundary.goHome")}
          </a>
        </div>
      </div>
    );
  }
}
