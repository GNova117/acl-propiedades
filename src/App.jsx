import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Calculator from "./pages/Calculator";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Rights from "./pages/Rights";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminPropertyForm from "./pages/admin/AdminPropertyForm";
import AdminPropertyLiquidacion from "./pages/admin/AdminPropertyLiquidacion";
import RequireSection from "./components/RequireSection";
import AdminAdvisors from "./pages/admin/AdminAdvisors";
import AdminAdvisorForm from "./pages/admin/AdminAdvisorForm";
import AdminZones from "./pages/admin/AdminZones";
import AdminClients from "./pages/admin/AdminClients";
import AdminClientForm from "./pages/admin/AdminClientForm";
import AdminClientDocuments from "./pages/admin/AdminClientDocuments";
import AdminClientProfiling from "./pages/admin/AdminClientProfiling";
import AdminRemodelProjects from "./pages/admin/AdminRemodelProjects";
import AdminRemodelProjectForm from "./pages/admin/AdminRemodelProjectForm";
import AdminMaterialsCatalog from "./pages/admin/AdminMaterialsCatalog";
import AdminMaterialCatalogForm from "./pages/admin/AdminMaterialCatalogForm";
import AdminInfonavitSimulator from "./pages/admin/AdminInfonavitSimulator";
import AdminRoles from "./pages/admin/AdminRoles";
import ProtectedRoute from "./components/ProtectedRoute";
import { SPECIAL_SECTION_TYPES } from "./lib/format";

const SPECIAL_SECTION_KEYS = Object.keys(SPECIAL_SECTION_TYPES);

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
      <Route path="/propiedades" element={<PublicLayout><Properties excludeTypes={SPECIAL_SECTION_KEYS} /></PublicLayout>} />
      <Route path="/propiedades/:id" element={<PublicLayout><PropertyDetail /></PublicLayout>} />
      <Route
        path="/naves-industriales"
        element={
          <PublicLayout>
            <Properties fixedType="nave_industrial" titleKey="properties.industrialTitle" subtitleKey="properties.industrialSubtitle" />
          </PublicLayout>
        }
      />
      <Route
        path="/terrenos"
        element={
          <PublicLayout>
            <Properties fixedType="terreno" titleKey="properties.landTitle" subtitleKey="properties.landSubtitle" />
          </PublicLayout>
        }
      />
      <Route path="/calculadora" element={<PublicLayout><Calculator /></PublicLayout>} />
      <Route path="/nosotros" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/contacto" element={<PublicLayout><Contact /></PublicLayout>} />
      <Route path="/aviso-de-privacidad" element={<PublicLayout><Privacy /></PublicLayout>} />
      <Route path="/carta-de-derechos" element={<PublicLayout><Rights /></PublicLayout>} />

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
        <Route
          path="propiedades"
          element={
            <RequireSection section="propiedades">
              <AdminProperties excludeTypes={["nave_industrial"]} />
            </RequireSection>
          }
        />
        <Route path="propiedades/nueva" element={<RequireSection section="propiedades"><AdminPropertyForm /></RequireSection>} />
        <Route path="propiedades/:id" element={<RequireSection section="propiedades"><AdminPropertyForm /></RequireSection>} />
        <Route
          path="propiedades/:id/liquidacion"
          element={
            <RequireSection section="liquidaciones">
              <AdminPropertyLiquidacion />
            </RequireSection>
          }
        />
        <Route
          path="naves-industriales"
          element={
            <RequireSection section="propiedades">
              <AdminProperties
                fixedType="nave_industrial"
                titleKey="admin.industrialWarehouses"
                newLabelKey="admin.newIndustrialWarehouse"
                basePath="/admin/naves-industriales"
              />
            </RequireSection>
          }
        />
        <Route
          path="naves-industriales/nueva"
          element={
            <RequireSection section="propiedades">
              <AdminPropertyForm
                fixedType="nave_industrial"
                listPath="/admin/naves-industriales"
                newTitleKey="admin.newIndustrialWarehouse"
                editTitleKey="admin.editIndustrialWarehouse"
              />
            </RequireSection>
          }
        />
        <Route
          path="naves-industriales/:id"
          element={
            <RequireSection section="propiedades">
              <AdminPropertyForm
                fixedType="nave_industrial"
                listPath="/admin/naves-industriales"
                newTitleKey="admin.newIndustrialWarehouse"
                editTitleKey="admin.editIndustrialWarehouse"
              />
            </RequireSection>
          }
        />
        <Route path="asesores" element={<RequireSection section="asesores"><AdminAdvisors /></RequireSection>} />
        <Route path="asesores/nuevo" element={<RequireSection section="asesores"><AdminAdvisorForm /></RequireSection>} />
        <Route path="asesores/:id" element={<RequireSection section="asesores"><AdminAdvisorForm /></RequireSection>} />
        <Route path="zonas" element={<RequireSection section="zonas"><AdminZones /></RequireSection>} />
        <Route path="clientes" element={<RequireSection section="clientes"><AdminClients /></RequireSection>} />
        <Route path="clientes/nuevo" element={<RequireSection section="clientes"><AdminClientForm /></RequireSection>} />
        <Route path="clientes/:id" element={<RequireSection section="clientes"><AdminClientForm /></RequireSection>} />
        <Route path="clientes/:id/documentos" element={<RequireSection section="clientes"><AdminClientDocuments /></RequireSection>} />
        <Route path="clientes/:id/perfilamiento" element={<RequireSection section="clientes"><AdminClientProfiling /></RequireSection>} />
        <Route path="remodelaciones" element={<RequireSection section="remodelaciones"><AdminRemodelProjects /></RequireSection>} />
        <Route path="remodelaciones/nuevo" element={<RequireSection section="remodelaciones"><AdminRemodelProjectForm /></RequireSection>} />
        <Route path="remodelaciones/:id" element={<RequireSection section="remodelaciones"><AdminRemodelProjectForm /></RequireSection>} />
        <Route path="materiales" element={<RequireSection section="materiales"><AdminMaterialsCatalog /></RequireSection>} />
        <Route path="materiales/nuevo" element={<RequireSection section="materiales"><AdminMaterialCatalogForm /></RequireSection>} />
        <Route path="materiales/:id" element={<RequireSection section="materiales"><AdminMaterialCatalogForm /></RequireSection>} />
        <Route path="credito-infonavit" element={<RequireSection section="credito_infonavit"><AdminInfonavitSimulator /></RequireSection>} />
        <Route path="roles" element={<RequireSection section="roles"><AdminRoles /></RequireSection>} />
      </Route>

      <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
    </Routes>
  );
}
