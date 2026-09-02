// Definición de campos del perfilamiento del vendedor, organizada en
// secciones (una por bloque impreso en el PDF). El motor de validación,
// payload y lectura vive en perfilamientoShared.js.

import { ESTADOS_CIVILES } from "./perfilamientoShared";

export const TIPOS_INMUEBLE = ["Casa habitación", "Departamento", "Terreno", "Local comercial", "Bodega", "Otro"];

export const FORMAS_ADQUISICION = [
  "Infonavit",
  "Fovissste",
  "Crédito bancario",
  "Compraventa",
  "Herencia",
  "Donación",
  "Otro",
];

export const GRAVAMENES = ["Libre de gravamen", "Con gravamen"];

export const VENDEDOR_SECTIONS = [
  {
    key: "vendedor",
    title: "Datos generales del vendedor",
    titleKey: "profiling.sellerSection",
    fields: [
      { key: "nombre_completo", label: "Nombre completo del vendedor", type: "text", required: true },
      { key: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date", required: true },
      { key: "estado_civil", label: "Estado civil", type: "select", options: ESTADOS_CIVILES },
      { key: "domicilio", label: "Domicilio", type: "textarea", required: true, full: true },
      { key: "correo", label: "Correo electrónico", type: "email", format: "email" },
      { key: "telefono", label: "Teléfono", type: "tel", format: "telefono" },
      { key: "rfc", label: "RFC", type: "text", format: "rfc", uppercase: true },
      { key: "curp", label: "CURP", type: "text", format: "curp", uppercase: true },
      { key: "identificacion_oficial", label: "Número de identificación oficial", type: "text" },
    ],
  },
  {
    key: "inmueble",
    title: "Datos generales del inmueble",
    titleKey: "profiling.propertySection",
    fields: [
      { key: "ubicacion", label: "Ubicación del inmueble", type: "textarea", required: true, full: true },
      { key: "tipo_inmueble", label: "Tipo de inmueble", type: "select", options: TIPOS_INMUEBLE },
      { key: "caracteristicas", label: "Características", type: "textarea", full: true },
      { key: "superficie_terreno", label: "Superficie de terreno (m²)", type: "number", unit: "m²" },
      { key: "superficie_construccion", label: "Superficie de construcción (m²)", type: "number", unit: "m²" },
      { key: "uso_suelo", label: "Uso de suelo", type: "text" },
      { key: "antiguedad", label: "Antigüedad (años)", type: "integer", unit: "años" },
      { key: "forma_adquisicion", label: "Forma de adquisición", type: "select", options: FORMAS_ADQUISICION },
      { key: "gravamenes", label: "Gravámenes de propiedad", type: "select", options: GRAVAMENES },
      // Solo se muestra (y se guarda) cuando gravamenes === "Con gravamen".
      {
        key: "gravamenes_detalle",
        label: "Detalle del gravamen",
        type: "textarea",
        full: true,
        dependsOn: { field: "gravamenes", value: "Con gravamen" },
      },
    ],
  },
  {
    key: "registro",
    title: "Datos de registro (Folio real)",
    titleKey: "profiling.registrySection",
    optional: true, // solo se muestra/imprime si al menos un campo tiene valor
    fields: [
      { key: "registro_partida", label: "Partida", type: "text" },
      { key: "registro_libro", label: "Libro", type: "text" },
      { key: "registro_seccion", label: "Sección", type: "text" },
      { key: "registro_fecha_inscripcion", label: "Fecha de inscripción", type: "date" },
    ],
  },
];

// Regla cruzada propia del vendedor: el detalle de gravamen es obligatorio
// si se eligió "Con gravamen".
export function vendedorExtraRules(form) {
  if (form.gravamenes === "Con gravamen" && !(form.gravamenes_detalle ?? "").trim()) {
    return { gravamenes_detalle: "Describe el gravamen" };
  }
  return {};
}

// Campos que la lista NO necesita: RFC, CURP e identificación oficial son
// datos sensibles y solo viajan cuando se abre un perfilamiento concreto.
export const PERFILAMIENTO_VENDEDOR_LIST_FIELDS = [
  "id",
  "cliente_id",
  "nombre_completo",
  "ubicacion",
  "tipo_inmueble",
  "fecha_creacion",
  "fecha_modificacion",
];
