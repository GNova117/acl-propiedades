import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function NotFound() {
  return (
    <div className="container empty-state" style={{ padding: "5rem 1.5rem" }}>
      <Seo title="404" description="Página no encontrada" />
      <h1>404</h1>
      <p>La página que buscas no existe.</p>
      <Link to="/" className="btn btn-primary">Volver al inicio</Link>
    </div>
  );
}
