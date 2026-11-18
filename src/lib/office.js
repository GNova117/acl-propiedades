// @ts-check
// ÚNICA fuente de los datos públicos de la oficina: teléfono, WhatsApp, correo y dirección. El pie de página, la página de
// Contacto, los botones de WhatsApp, la ficha en PDF, la guía del comprador, el chatbot y los datos estructurados para Google
// salen de aquí. Para cambiar un dato se cambia AQUÍ (y nada más); src/lib/office.test.js falla si alguien lo vuelve a copiar.
// El número es el de la oficina (871 324 3271), distinto del número dedicado de WhatsApp Business que manda los avisos
// automáticos (ese vive en los secretos de las funciones de Supabase, no aquí).
const PHONE_DIGITS = "8713243271"; // 10 dígitos, sin lada de país

export const OFFICE = {
  name: "ACL Propiedades",
  phoneDisplay: "871 324 3271",
  phoneTel: `+52${PHONE_DIGITS}`,
  whatsapp: `52${PHONE_DIGITS}`,
  whatsappUrl: `https://wa.me/52${PHONE_DIGITS}`,
  email: "inmobiliaria@aclpropiedades.com",
  // Dirección: corta (pie de página y chatbot) y completa (contacto y datos estructurados).
  addressShort: "Blvd. Independencia, Local 16, Plaza San Luciano",
  addressCity: "Torreón, Coahuila",
  streetAddress: "Blvd. Independencia 2600, Local 16, Plaza San Luciano, Estrella",
  postalCode: "27010",
  city: "Torreón",
  region: "Coahuila",
  regionShort: "Coah.",
  country: "MX",
  areaServed: ["Torreón", "Gómez Palacio", "Lerdo"],
  facebook: "https://www.facebook.com/Aclpropiedadess/",
};

// Compatibilidad con quien ya importaba esta constante (botón flotante y WhatsApp de cada propiedad).
export const OFFICE_WHATSAPP = OFFICE.whatsapp;
