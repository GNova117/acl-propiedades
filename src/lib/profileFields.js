// Campos del perfilamiento de comprador/vendedor. El cliente del negocio
// definirá los campos reales más adelante — agregar uno nuevo es agregar un
// objeto a uno de estos arreglos (más su traducción en clientProfile.fields
// de es.json/en.json); no requiere migrar la base de datos ni tocar
// ClientProfileForm. Las respuestas se guardan en clients.profile como
// { buyer: {...}, seller: {...} }, así que las `key` solo deben ser únicas
// dentro de su propio arreglo (no entre BUYER y SELLER).
//
// Renombrar una `key` existente deja huérfanos los valores ya guardados con
// el nombre viejo (jsonb no tiene schema) — si hace falta renombrar, se
// necesita un script de migración de datos aparte.
//
// type: "text" | "number" | "textarea" | "select" | "boolean"
// Para type "select", `options` es un arreglo de valores; sus etiquetas se
// resuelven vía t(`clientProfile.options.${key}.${option}`).

export const BUYER_PROFILE_FIELDS = [
  { key: "budget", label: "clientProfile.fields.budget", type: "number" },
  { key: "preferredZone", label: "clientProfile.fields.preferredZone", type: "text" },
  {
    key: "financing",
    label: "clientProfile.fields.financing",
    type: "select",
    options: ["infonavit", "bancario", "fovissste", "contado"],
  },
];

export const SELLER_PROFILE_FIELDS = [
  { key: "reasonForSelling", label: "clientProfile.fields.reasonForSelling", type: "textarea" },
  { key: "expectedPrice", label: "clientProfile.fields.expectedPrice", type: "number" },
  { key: "hasLiens", label: "clientProfile.fields.hasLiens", type: "boolean" },
];
