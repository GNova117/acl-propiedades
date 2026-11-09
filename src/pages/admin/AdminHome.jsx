import { Navigate } from "react-router-dom";
import { HOME_MY_DAY } from "../../lib/adminHome";
import { useAdminHome } from "../../lib/useAdminHome";
import AdminDashboard from "./AdminDashboard";

// /admin: abre "Mi día" si es el inicio de esta persona (los asesores, por
// omisión) y el Panel principal si no. El Panel sigue en /admin/panel.
export default function AdminHome() {
  const { home } = useAdminHome();
  if (home === HOME_MY_DAY) return <Navigate to="/admin/mi-dia" replace />;
  return <AdminDashboard />;
}
