import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "./components/Header";
import Footer from "./components/Footer";
import FloatingWhatsApp from "./components/FloatingWhatsApp";
import Home from "./pages/Home";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Calculator from "./pages/Calculator";
import CreditSimulator from "./pages/CreditSimulator";
import SellYourHome from "./pages/SellYourHome";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Favorites from "./pages/Favorites";
import Compare from "./pages/Compare";
import Privacy from "./pages/Privacy";
import Rights from "./pages/Rights";
import NotFound from "./pages/NotFound";
import { db } from "./lib/dataStore";
import { applyPropertyTypeLabels } from "./lib/propertyTypeLabels";
import RequireSection from "./components/RequireSection";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import SeasonalGarland from "./components/SeasonalGarland";
import SeasonalParticles from "./components/SeasonalParticles";
import { SPECIAL_SECTION_TYPES } from "./lib/format";
import { initAnalytics, trackPageview } from "./lib/analytics";

// Todo /admin va en su propio chunk, separado del bundle público — un
// visitante que solo ve propiedades nunca descarga el código del panel de
// administración. `Suspense` (con el mismo fallback que ya usan las
// páginas del admin mientras cargan datos) cubre el instante de red que
// tarda en bajar el chunk la primera vez que alguien entra a /admin.
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProperties = lazy(() => import("./pages/admin/AdminProperties"));
const AdminPropertyForm = lazy(() => import("./pages/admin/AdminPropertyForm"));
const AdminPropertyLiquidacion = lazy(() => import("./pages/admin/AdminPropertyLiquidacion"));
const AdminPropertyHistory = lazy(() => import("./pages/admin/AdminPropertyHistory"));
const AdminAdvisors = lazy(() => import("./pages/admin/AdminAdvisors"));
const AdminAdvisorForm = lazy(() => import("./pages/admin/AdminAdvisorForm"));
const AdminZones = lazy(() => import("./pages/admin/AdminZones"));
const AdminClients = lazy(() => import("./pages/admin/AdminClients"));
const AdminClientForm = lazy(() => import("./pages/admin/AdminClientForm"));
const AdminClientDocuments = lazy(() => import("./pages/admin/AdminClientDocuments"));
const AdminClientProfiling = lazy(() => import("./pages/admin/AdminClientProfiling"));
const AdminClientJoint = lazy(() => import("./pages/admin/AdminClientJoint"));
const AdminRemodelProjects = lazy(() => import("./pages/admin/AdminRemodelProjects"));
const AdminRemodelProjectForm = lazy(() => import("./pages/admin/AdminRemodelProjectForm"));
const AdminRemodelProgress = lazy(() => import("./pages/admin/AdminRemodelProgress"));
const AdminMaterialsCatalog = lazy(() => import("./pages/admin/AdminMaterialsCatalog"));
const AdminMaterialCatalogForm = lazy(() => import("./pages/admin/AdminMaterialCatalogForm"));
const AdminConstruccionProjects = lazy(() => import("./pages/admin/AdminConstruccionProjects"));
const AdminConstruccionForm = lazy(() => import("./pages/admin/AdminConstruccionForm"));
const AdminConstruccionProject = lazy(() => import("./pages/admin/AdminConstruccionProject"));
const AdminInfonavitSimulator = lazy(() => import("./pages/admin/AdminInfonavitSimulator"));
const AdminValuation = lazy(() => import("./pages/admin/AdminValuation"));
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminLegalDocs = lazy(() => import("./pages/admin/AdminLegalDocs"));
const AdminAgenda = lazy(() => import("./pages/admin/AdminAgenda"));
const AdminAgendaForm = lazy(() => import("./pages/admin/AdminAgendaForm"));
const AdminAgendaExpedientes = lazy(() => import("./pages/admin/AdminAgendaExpedientes"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminTestimonials = lazy(() => import("./pages/admin/AdminTestimonials"));
const AdminSalesReports = lazy(() => import("./pages/admin/AdminSalesReports"));
const AdminPropertyBitacora = lazy(() => import("./pages/admin/AdminPropertyBitacora"));
const AdminSecretaria = lazy(() => import("./pages/admin/AdminSecretaria"));
const AdminProspects = lazy(() => import("./pages/admin/AdminProspects"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const AdminClientHistory = lazy(() => import("./pages/admin/AdminClientHistory"));
const AdminProspectForm = lazy(() => import("./pages/admin/AdminProspectForm"));
const AdminVisits = lazy(() => import("./pages/admin/AdminVisits"));
const AdminVisitForm = lazy(() => import("./pages/admin/AdminVisitForm"));
const AdminPropertyVisits = lazy(() => import("./pages/admin/AdminPropertyVisits"));
// Informe que recibe el vendedor por enlace privado. Es público (sin login) pero
// no es una página del sitio: ver la ruta /informe/:token más abajo.
const PublicVisitReport = lazy(() => import("./pages/PublicVisitReport"));
const PublicSign = lazy(() => import("./pages/PublicSign"));
const AdminSignatures = lazy(() => import("./pages/admin/AdminSignatures"));
const AdminFunnel = lazy(() => import("./pages/admin/AdminFunnel"));

const SPECIAL_SECTION_KEYS = Object.keys(SPECIAL_SECTION_TYPES);

function PublicLayout({ children }) {
  // key={pathname}, no location.search: cambiar de página desvanece el
  // contenido de entrada, pero cambiar solo un filtro (?tipo=casa) en la
  // misma página no — eso ya lo maneja cada página por su cuenta.
  const { pathname } = useLocation();

  useEffect(() => {
    // initAnalytics() se llama aquí (no en main.jsx) y no en AdminLayout —
    // así el script de GA nunca se carga si alguien entra directo a
    // /admin sin pasar por una página pública en la misma visita. Es
    // idempotente (guardia interna en analytics.js), así que llamarla en
    // cada cambio de ruta no reinicia nada.
    initAnalytics();
    trackPageview(pathname);
  }, [pathname]);

  return (
    <>
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <Header />
      <SeasonalGarland />
      <main id="main-content" key={pathname} className="page-transition" style={{ flex: 1 }}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}

export default function App() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  // Nombres de tipos de propiedad editables desde /admin/zonas: se inyectan en
  // las traducciones para que se vean en todo el sitio (ver propertyTypeLabels.js).
  useEffect(() => {
    db.getPropertyTypes().then(applyPropertyTypeLabels).catch(() => {});
  }, []);

  return (
    <Suspense fallback={<div className="empty-state">{t("common.loading")}</div>}>
    {!pathname.startsWith("/admin") && !pathname.startsWith("/informe/") && <SeasonalParticles />}
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
      <Route path="/simulador-credito" element={<PublicLayout><CreditSimulator /></PublicLayout>} />
      <Route path="/vende-tu-casa" element={<PublicLayout><SellYourHome /></PublicLayout>} />
      <Route path="/nosotros" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/contacto" element={<PublicLayout><Contact /></PublicLayout>} />
      <Route path="/favoritos" element={<PublicLayout><Favorites /></PublicLayout>} />
      <Route path="/comparar" element={<PublicLayout><Compare /></PublicLayout>} />
      <Route path="/aviso-de-privacidad" element={<PublicLayout><Privacy /></PublicLayout>} />
      <Route path="/carta-de-derechos" element={<PublicLayout><Rights /></PublicLayout>} />
      {/* Sin PublicLayout a propósito: ese layout manda cada ruta a Google
          Analytics y el token del enlace (que es lo que da acceso) no debe
          llegar ahí; tampoco necesita el menú ni las decoraciones del sitio. */}
      <Route path="/informe/:token" element={<ErrorBoundary><PublicVisitReport /></ErrorBoundary>} />
      <Route path="/firmar/:token" element={<ErrorBoundary><PublicSign /></ErrorBoundary>} />

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
        <Route path="propiedades/:id/bitacora" element={<RequireSection section="bitacora"><AdminPropertyBitacora /></RequireSection>} />
        <Route
          path="naves-industriales/:id/bitacora"
          element={
            <RequireSection section="bitacora">
              <AdminPropertyBitacora listPath="/admin/naves-industriales" />
            </RequireSection>
          }
        />
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
            <RequireSection section="naves_industriales">
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
            <RequireSection section="naves_industriales">
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
            <RequireSection section="naves_industriales">
              <AdminPropertyForm
                fixedType="nave_industrial"
                listPath="/admin/naves-industriales"
                newTitleKey="admin.newIndustrialWarehouse"
                editTitleKey="admin.editIndustrialWarehouse"
              />
            </RequireSection>
          }
        />
        <Route path="propiedades/:id/historial" element={<RequireSection section="propiedades"><AdminPropertyHistory /></RequireSection>} />
        <Route
          path="naves-industriales/:id/historial"
          element={
            <RequireSection section="naves_industriales">
              <AdminPropertyHistory listPath="/admin/naves-industriales" />
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
        <Route path="clientes/:id/historial" element={<RequireSection section="clientes"><AdminClientHistory /></RequireSection>} />
        <Route path="clientes/:id/perfilamiento" element={<RequireSection section="clientes"><AdminClientProfiling /></RequireSection>} />
        <Route path="clientes/:id/conjunto" element={<RequireSection section="clientes"><AdminClientJoint /></RequireSection>} />
        <Route path="remodelaciones" element={<RequireSection section="remodelaciones"><AdminRemodelProjects /></RequireSection>} />
        <Route path="remodelaciones/nuevo" element={<RequireSection section="remodelaciones"><AdminRemodelProjectForm /></RequireSection>} />
        <Route path="remodelaciones/:id" element={<RequireSection section="remodelaciones"><AdminRemodelProjectForm /></RequireSection>} />
        <Route path="remodelaciones/:id/progreso" element={<RequireSection section="remodelaciones"><AdminRemodelProgress /></RequireSection>} />
        <Route path="materiales" element={<RequireSection section="materiales"><AdminMaterialsCatalog /></RequireSection>} />
        <Route path="materiales/nuevo" element={<RequireSection section="materiales"><AdminMaterialCatalogForm /></RequireSection>} />
        <Route path="materiales/:id" element={<RequireSection section="materiales"><AdminMaterialCatalogForm /></RequireSection>} />
        <Route path="construccion" element={<RequireSection section="construccion"><AdminConstruccionProjects /></RequireSection>} />
        <Route path="construccion/nuevo" element={<RequireSection section="construccion"><AdminConstruccionForm /></RequireSection>} />
        <Route path="construccion/:id" element={<RequireSection section="construccion"><AdminConstruccionProject /></RequireSection>} />
        <Route path="credito-infonavit" element={<RequireSection section="credito_infonavit"><AdminInfonavitSimulator /></RequireSection>} />
        <Route path="valuacion" element={<RequireSection section="valuacion"><AdminValuation /></RequireSection>} />
        <Route path="firmas" element={<RequireSection section="documentos_legales"><AdminSignatures /></RequireSection>} />
        <Route path="documentos-legales" element={<RequireSection section="documentos_legales"><AdminLegalDocs /></RequireSection>} />
        <Route path="actividad" element={<RequireSection section="roles"><AdminActivity /></RequireSection>} />
        <Route path="roles" element={<RequireSection section="roles"><AdminRoles /></RequireSection>} />
        <Route path="agenda" element={<RequireSection section="agenda"><AdminAgenda /></RequireSection>} />
        <Route path="agenda/nueva" element={<RequireSection section="agenda"><AdminAgendaForm /></RequireSection>} />
        <Route path="agenda/:id" element={<RequireSection section="agenda"><AdminAgendaForm /></RequireSection>} />
        <Route path="agenda/:id/expedientes" element={<RequireSection section="agenda"><AdminAgendaExpedientes /></RequireSection>} />
        <Route path="mensajes" element={<RequireSection section="mensajes"><AdminMessages /></RequireSection>} />
        <Route path="testimonios" element={<RequireSection section="testimonios"><AdminTestimonials /></RequireSection>} />
        <Route path="reportes" element={<RequireSection section="reportes"><AdminSalesReports /></RequireSection>} />
        <Route path="secretaria" element={<RequireSection section="secretaria"><AdminSecretaria /></RequireSection>} />
        <Route path="estadisticas" element={<RequireSection section="prospectos"><AdminFunnel /></RequireSection>} />
        <Route path="prospectos" element={<RequireSection section="prospectos"><AdminProspects /></RequireSection>} />
        <Route path="prospectos/nuevo" element={<RequireSection section="prospectos"><AdminProspectForm /></RequireSection>} />
        <Route path="prospectos/:id" element={<RequireSection section="prospectos"><AdminProspectForm /></RequireSection>} />
        <Route path="visitas" element={<RequireSection section="visitas"><AdminVisits /></RequireSection>} />
        <Route path="visitas/nueva" element={<RequireSection section="visitas"><AdminVisitForm /></RequireSection>} />
        <Route path="visitas/propiedad/:propertyId" element={<RequireSection section="visitas"><AdminPropertyVisits /></RequireSection>} />
        <Route path="visitas/:id" element={<RequireSection section="visitas"><AdminVisitForm /></RequireSection>} />
      </Route>

      <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
    </Routes>
    </Suspense>
  );
}
