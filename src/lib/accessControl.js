// Apartados del admin que se pueden otorgar/quitar por rol (admin_roles.sections
// en Supabase). "Panel" no está aquí a propósito: todo el que inicia sesión lo ve,
// no es un permiso. Si se agrega un apartado nuevo al admin en el futuro, se
// agrega su clave aquí y se le asigna a los roles que corresponda desde
// /admin/roles — no hace falta tocar RLS ni código de rutas para eso.
export const SECTION_KEYS = [
  "propiedades",
  "asesores",
  "zonas",
  "clientes",
  "remodelaciones",
  "materiales",
  "credito_infonavit",
  "liquidaciones",
  "roles",
];

// El rol con este slug es el único con permiso para crear/editar/borrar roles
// y accesos (ver política RLS is_admin_role() en supabase/schema.sql). No es
// editable ni borrable desde /admin/roles para no dejar el sitio sin nadie que
// pueda gestionar accesos.
export const ADMIN_ROLE_SLUG = "admin";
