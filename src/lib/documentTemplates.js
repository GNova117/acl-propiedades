// Plantillas de documentos personalizadas (creadas desde /admin/plantillas-documentos,
// sin tocar código). El cuerpo de la plantilla es texto libre con marcadores
// {{cliente.nombre}}, {{propiedad.precio}}, etc. — esta función los rellena con
// los datos reales y arma el mismo `content` que ya dibuja contractPdf.js
// (buildContractPdf/downloadContractPdf), así se reutiliza el generador de PDF
// ya existente sobre la hoja membretada en vez de duplicar esa lógica.

const PLACE = "Torreón, Coahuila";

const mxn = (v) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(v) || 0);
const longDate = () => new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

// Lista para mostrar como ayuda en el editor de plantillas: qué marcadores
// están disponibles y de dónde sale cada uno.
export const AVAILABLE_PLACEHOLDERS = [
  { key: "cliente.nombre", hint: "Nombre del cliente seleccionado" },
  { key: "cliente.telefono", hint: "Teléfono del cliente" },
  { key: "cliente.email", hint: "Correo del cliente" },
  { key: "propiedad.titulo", hint: "Título de la propiedad seleccionada" },
  { key: "propiedad.codigo", hint: "Código de la propiedad" },
  { key: "propiedad.precio", hint: "Precio de la propiedad, formateado en MXN" },
  { key: "propiedad.direccion", hint: "Dirección de la propiedad" },
  { key: "propiedad.zona", hint: "Zona de la propiedad" },
  { key: "asesor.nombre", hint: "Nombre del asesor que genera el documento" },
  { key: "fecha", hint: "Fecha de hoy, en español" },
  { key: "lugar", hint: `Lugar fijo (${PLACE})` },
];

export function buildPlaceholderContext({ client, property, advisor, customValues = {} } = {}) {
  const context = {
    "cliente.nombre": client?.name || "",
    "cliente.telefono": client?.phone || "",
    "cliente.email": client?.email || "",
    "propiedad.titulo": property?.title || "",
    "propiedad.codigo": property?.code || "",
    "propiedad.precio": property ? mxn(property.price) : "",
    "propiedad.direccion": property?.address || "",
    "propiedad.zona": property?.zone || "",
    "asesor.nombre": advisor?.name || "",
    fecha: longDate(),
    lugar: PLACE,
  };
  for (const [key, value] of Object.entries(customValues)) {
    context[`campo.${key}`] = value == null ? "" : String(value);
  }
  return context;
}

// Un marcador sin valor conocido se deja tal cual (en vez de borrarlo): así un
// error de dedo en la plantilla ("{{clientee.nombre}}") se nota en el PDF en
// lugar de desaparecer en silencio.
export function renderPlaceholders(body, context) {
  return String(body || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => (key in context ? context[key] : match));
}

// `content` listo para buildContractPdf/downloadContractPdf (src/lib/contractPdf.js).
export function buildTemplateContent(template, { client, property, advisor, customValues } = {}) {
  const context = buildPlaceholderContext({ client, property, advisor, customValues });
  const rendered = renderPlaceholders(template.body, context);
  const paragraphs = rendered
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const signatures = template.requires_signatures
    ? [
        { label: "Cliente", name: client?.name || "" },
        { label: "ACL Propiedades", name: advisor?.name ? `Asesor: ${advisor.name}` : "" },
      ]
    : [];

  return {
    title: template.name,
    placeDate: `${PLACE}, a ${longDate()}.`,
    paragraphs,
    signatures,
    fileName: `${template.name}_${client?.name || "documento"}`,
  };
}
