import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

// Se usa DENTRO de ProtectedRoute (ya garantiza sesión iniciada) para
// restringir además por apartado, según el rol asignado en admin_access.
// Para Liquidaciones y Clientes esta no es la barrera real —esa vive en las
// políticas RLS de Supabase— pero evita que alguien sin el apartado llegue
// siquiera a ver la pantalla; para el resto de apartados sí es la única
// barrera (el bloqueo ahí es solo de menú/ruta, no de base de datos).
export default function RequireSection({ section, children }) {
  const { hasSection, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;
  if (!hasSection(section)) return <div className="empty-state">{t("accessControl.restricted")}</div>;

  return children;
}
