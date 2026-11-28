import { Outlet } from "react-router-dom";
import { AuthProvider } from "./AuthContext";

// Ruta «envoltorio» del panel: la sesión (AuthProvider) solo se inicializa dentro de /admin/*, no para quien navega el sitio público.
export default function AuthShell() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
