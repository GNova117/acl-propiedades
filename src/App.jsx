import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Calculator from "./pages/Calculator";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminPropertyForm from "./pages/admin/AdminPropertyForm";
import AdminAdvisors from "./pages/admin/AdminAdvisors";
import AdminAdvisorForm from "./pages/admin/AdminAdvisorForm";
import AdminZones from "./pages/admin/AdminZones";
import AdminClients from "./pages/admin/AdminClients";
import AdminClientForm from "./pages/admin/AdminClientForm";
import AdminClientDocuments from "./pages/admin/AdminClientDocuments";
import AdminRemodelProjects from "./pages/admin/AdminRemodelProjects";
import AdminRemodelProjectForm from "./pages/admin/AdminRemodelProjectForm";
import AdminMaterialsCatalog from "./pages/admin/AdminMaterialsCatalog";
import AdminMaterialCatalogForm from "./pages/admin/AdminMaterialCatalogForm";
import ProtectedRoute from "./components/ProtectedRoute";

function PublicLayout({ children }) {
  return (
    <>
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <Header />
      <main id="main-content" style={{ flex: 1 }}>{children}</main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/propiedades" element={<PublicLayout><Properties /></PublicLayout>} />
      <Route path="/propiedades/:id" element={<PublicLayout><PropertyDetail /></PublicLayout>} />
      <Route path="/calculadora" element={<PublicLayout><Calculator /></PublicLayout>} />
      <Route path="/nosotros" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/contacto" element={<PublicLayout><Contact /></PublicLayout>} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="propiedades" element={<AdminProperties />} />
        <Route path="propiedades/nueva" element={<AdminPropertyForm />} />
        <Route path="propiedades/:id" element={<AdminPropertyForm />} />
        <Route path="asesores" element={<AdminAdvisors />} />
        <Route path="asesores/nuevo" element={<AdminAdvisorForm />} />
        <Route path="asesores/:id" element={<AdminAdvisorForm />} />
        <Route path="zonas" element={<AdminZones />} />
        <Route path="clientes" element={<AdminClients />} />
        <Route path="clientes/nuevo" element={<AdminClientForm />} />
        <Route path="clientes/:id" element={<AdminClientForm />} />
        <Route path="clientes/:id/documentos" element={<AdminClientDocuments />} />
        <Route path="remodelaciones" element={<AdminRemodelProjects />} />
        <Route path="remodelaciones/nuevo" element={<AdminRemodelProjectForm />} />
        <Route path="remodelaciones/:id" element={<AdminRemodelProjectForm />} />
        <Route path="materiales" element={<AdminMaterialsCatalog />} />
        <Route path="materiales/nuevo" element={<AdminMaterialCatalogForm />} />
        <Route path="materiales/:id" element={<AdminMaterialCatalogForm />} />
      </Route>

      <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
    </Routes>
  );
}
