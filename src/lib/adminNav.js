// Menú por carpetas. Cada item se muestra solo si el rol tiene ese apartado;
// una carpeta sin ningún item visible no se dibuja. Los apartados sueltos
// (sin carpeta) van como { section, to, label } directo en la lista.
export const NAV = [
  { section: null, to: "/admin", end: true, labelKey: "admin.dashboard" },
  // Lo de hoy en un solo lugar: se muestra con la agenda o con prospectos.
  { section: null, anySection: ["agenda", "prospectos"], to: "/admin/mi-dia", labelKey: "admin.myDay" },
  // Sin apartado: se muestra por tener un login vinculado a un asesor
  // (advisorId), no por un permiso de rol — ver AdminMyProfile.jsx.
  { section: null, to: "/admin/mi-perfil", labelKey: "admin.myProfile", requiresAdvisor: true },
  {
    key: "propiedades",
    labelKey: "admin.groups.propiedades",
    items: [
      { section: "propiedades", to: "/admin/propiedades", labelKey: "admin.properties" },
      { section: "propiedades", to: "/admin/desarrollos", labelKey: "developments.admin.navTitle" },
      { section: "naves_industriales", to: "/admin/naves-industriales", labelKey: "admin.industrialWarehouses" },
      { section: "zonas", to: "/admin/zonas", labelKey: "admin.zones" },
      { section: "asesores", to: "/admin/asesores", labelKey: "admin.advisors" },
    ],
  },
  {
    key: "clientes",
    labelKey: "admin.groups.clientes",
    items: [
      { section: "clientes", to: "/admin/clientes", labelKey: "admin.clients" },
      { section: "prospectos", to: "/admin/prospectos", labelKey: "accessControl.sections.prospectos" },
      { section: "prospectos", to: "/admin/equipo", labelKey: "team.navTitle", officeOnly: true },
      { section: "prospectos", to: "/admin/estadisticas", labelKey: "funnel.title" },
      { section: "prospectos", to: "/admin/alertas", labelKey: "alerts.admin.title" },
      { section: "mensajes", to: "/admin/mensajes", labelKey: "admin.messages", badge: true },
      { section: "testimonios", to: "/admin/testimonios", labelKey: "admin.testimonials" },
      { section: "blog", to: "/admin/blog", labelKey: "blog.admin.title" },
      { section: "visitas", to: "/admin/visitas", labelKey: "accessControl.sections.visitas" },
    ],
  },
  {
    key: "herramientas",
    labelKey: "admin.groups.herramientas",
    items: [
      { section: "gastos", to: "/admin/gastos", labelKey: "accessControl.sections.gastos" },
      { section: "valuacion", to: "/admin/valuacion", labelKey: "accessControl.sections.valuacion" },
      { section: "valuacion", to: "/admin/solicitud-avaluo", labelKey: "solicitudAvaluo.navTitle" },
      { section: "inspecciones", to: "/admin/inspecciones", labelKey: "accessControl.sections.inspecciones" },
      { section: "credito_infonavit", to: "/admin/credito-infonavit", labelKey: "admin.infonavitSimulator" },
      { section: "credito_infonavit", to: "/admin/solicitud-credito", labelKey: "solicitudCredito.navTitle" },
      { section: "documentos_legales", to: "/admin/documentos-legales", labelKey: "accessControl.sections.documentos_legales" },
      { section: "documentos_legales", to: "/admin/plantillas-documentos", labelKey: "documentTemplates.title" },
      { section: "documentos_legales", to: "/admin/firmas", labelKey: "signing.admin.title" },
    ],
  },
  {
    key: "obra",
    labelKey: "admin.groups.obra",
    items: [
      { section: "remodelaciones", to: "/admin/remodelaciones", labelKey: "admin.remodelProjects" },
      { section: "materiales", to: "/admin/materiales", labelKey: "materialsCatalog.title" },
      { section: "construccion", to: "/admin/construccion", label: "Construcción" },
    ],
  },
  {
    key: "oficina",
    labelKey: "admin.groups.oficina",
    items: [
      { section: "agenda", to: "/admin/agenda", labelKey: "accessControl.sections.agenda" },
      { section: "secretaria", to: "/admin/secretaria", labelKey: "accessControl.sections.secretaria" },
      { section: "reportes", to: "/admin/reportes", labelKey: "accessControl.sections.reportes" },
      { section: "reportes", to: "/admin/reporte-mensual", labelKey: "monthly.title" },
      { section: "liquidaciones", to: "/admin/comisiones", labelKey: "commissions.navTitle" },
      { section: "roles", to: "/admin/actividad", labelKey: "activity.title" },
      { section: "roles", to: "/admin/errores", labelKey: "errors.navTitle" },
      { section: "novedades", to: "/admin/novedades", labelKey: "novedades.admin.title" },
    ],
  },
  { section: "roles", to: "/admin/roles", labelKey: "accessControl.sections.roles" },
  { section: null, to: "/admin/seguridad", labelKey: "security.navTitle" },
  { section: null, to: "/admin/ayuda", labelKey: "help.navTitle" },
];
