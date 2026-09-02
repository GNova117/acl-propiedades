// Únicos dos correos con acceso al módulo de Liquidaciones (financiero
// interno, confidencial). Esta lista se usa tanto para decidir qué se
// muestra en pantalla como referencia para las políticas RLS de Supabase
// (supabase/schema.sql) — la restricción real vive en la base de datos, esto
// solo evita mostrar el botón/ruta a quien no debería ni intentarlo.
export const PARTNER_EMAILS = ["inmobiliaria@aclpropiedades.com", "mh@aclpropiedades.com"];

export function isPartnerEmail(email) {
  return !!email && PARTNER_EMAILS.includes(email.toLowerCase());
}
