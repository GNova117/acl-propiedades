import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

// Se usa DENTRO de ProtectedRoute (ya garantiza sesión iniciada) para
// restringir además a los dos socios. No es la barrera real de seguridad
// —esa vive en las políticas RLS de Supabase (tabla `liquidaciones`)— pero
// evita que alguien sin acceso llegue siquiera a ver el formulario.
export default function PartnerRoute({ children }) {
  const { isPartner, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;
  if (!isPartner) return <div className="empty-state">{t("liquidacion.restricted")}</div>;

  return children;
}
