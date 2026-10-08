// Definición de campos de la "Solicitud de avalúo inmobiliario y dictamen
// técnico de calidad" (formato INFONAVIT), organizada en las mismas 4
// secciones que trae el formato impreso. Usa el mismo motor genérico que el
// perfilamiento (perfilamientoShared.js) para validar, armar el payload y
// generar el PDF (perfilamientoPdf.js) — mismo look que el resto de hojas
// membretadas de la app.

export const DESTINO_CREDITO_OPTIONS = [
  "Comprar una vivienda",
  "Construir tu vivienda",
  "Ampliar, remodelar o mejorar tu vivienda",
  "Pagar la hipoteca de tu vivienda",
];

export const SOLICITUD_AVALUO_SECTIONS = [
  {
    key: "destino",
    title: "Destino del crédito",
    titleKey: "solicitudAvaluo.sections.destino",
    fields: [
      {
        key: "destino_credito",
        label: "Destino del crédito",
        type: "select",
        options: DESTINO_CREDITO_OPTIONS,
        required: true,
        full: true,
      },
    ],
  },
  {
    key: "derechohabiente",
    title: "1. Datos de identificación del derechohabiente",
    titleKey: "solicitudAvaluo.sections.derechohabiente",
    fields: [
      { key: "nss", label: "Número de Seguridad Social (NSS)", type: "text", format: "nss", required: true },
      { key: "dh_apellido_paterno", label: "Apellido paterno", type: "text", required: true, uppercase: true },
      { key: "dh_apellido_materno", label: "Apellido materno", type: "text", uppercase: true },
      { key: "dh_nombres", label: "Nombre(s)", type: "text", required: true, uppercase: true },
      { key: "dh_calle_numero", label: "Calle y número", type: "text", full: true },
      { key: "dh_colonia", label: "Colonia o fraccionamiento", type: "text" },
      { key: "dh_municipio", label: "Municipio o delegación", type: "text" },
      { key: "dh_estado", label: "Estado (entidad)", type: "text" },
      { key: "dh_codigo_postal", label: "Código postal", type: "text" },
      { key: "dh_telefono_casa", label: "Teléfono casa", type: "tel", format: "telefono" },
      { key: "dh_telefono_trabajo", label: "Teléfono trabajo", type: "tel", format: "telefono" },
      { key: "dh_telefono_celular", label: "Teléfono celular", type: "tel", format: "telefono" },
    ],
  },
  {
    key: "propietario",
    title: "2. Datos del propietario actual de la vivienda",
    titleKey: "solicitudAvaluo.sections.propietario",
    fields: [
      { key: "prop_apellido_paterno", label: "Apellido paterno", type: "text", uppercase: true },
      { key: "prop_apellido_materno", label: "Apellido materno", type: "text", uppercase: true },
      {
        key: "prop_nombre_razon_social",
        label: "Nombre(s) persona física o razón social persona moral",
        type: "text",
        full: true,
      },
      { key: "prop_rfc", label: "RFC", type: "text", format: "rfc", uppercase: true },
      {
        key: "prop_acreedor_hipotecario",
        label: "Nombre del acreedor hipotecario / fideicomiso (en su caso)",
        type: "text",
        full: true,
      },
      { key: "prop_rfc_acreedor", label: "RFC del acreedor", type: "text", uppercase: true },
      { key: "prop_calle_numero", label: "Calle y número", type: "text", full: true },
      { key: "prop_colonia", label: "Colonia", type: "text" },
      { key: "prop_municipio", label: "Municipio o delegación", type: "text" },
      { key: "prop_estado", label: "Estado (entidad)", type: "text" },
      { key: "prop_codigo_postal", label: "Código postal", type: "text" },
      { key: "prop_telefono_trabajo", label: "Teléfono trabajo", type: "tel", format: "telefono" },
      { key: "prop_telefono_celular", label: "Teléfono celular", type: "tel", format: "telefono" },
    ],
  },
  {
    key: "vivienda",
    title: "3. Datos de la vivienda objeto del crédito",
    titleKey: "solicitudAvaluo.sections.vivienda",
    fields: [
      {
        key: "viv_clave_conjunto",
        label: "Clave del conjunto habitacional de 16 dígitos (solo en caso de oferta registrada)",
        type: "text",
        full: true,
      },
      { key: "viv_calle", label: "Calle", type: "text", full: true },
      { key: "viv_numero_exterior", label: "No. exterior", type: "text" },
      { key: "viv_numero_interior", label: "No. interior", type: "text" },
      { key: "viv_lote", label: "Lote", type: "text" },
      { key: "viv_manzana", label: "Manzana", type: "text" },
      { key: "viv_colonia", label: "Colonia o fraccionamiento", type: "text" },
      { key: "viv_municipio", label: "Municipio o delegación", type: "text" },
      { key: "viv_estado", label: "Estado (entidad)", type: "text" },
      { key: "viv_codigo_postal", label: "Código postal", type: "text" },
      { key: "viv_antiguedad", label: "Antigüedad", type: "integer", unit: "años" },
    ],
  },
  {
    key: "tramite",
    title: "4. Lugar y fecha de la solicitud",
    titleKey: "solicitudAvaluo.sections.tramite",
    optional: true,
    fields: [
      { key: "ciudad_solicitud", label: "Ciudad", type: "text" },
      { key: "fecha_solicitud", label: "Fecha de la solicitud", type: "date" },
      { key: "notas", label: "Notas", type: "textarea", full: true },
    ],
  },
];

export const SOLICITUD_AVALUO_PDF_TITLE = "SOLICITUD DE AVALUO INMOBILIARIO Y DICTAMEN TECNICO DE CALIDAD";

// Columnas que la lista necesita para mostrarse sin pedir el registro
// completo (igual que PERFILAMIENTO_VENDEDOR_LIST_FIELDS).
export const SOLICITUD_AVALUO_LIST_FIELDS = [
  "id",
  "cliente_id",
  "propiedad_id",
  "destino_credito",
  "dh_apellido_paterno",
  "dh_apellido_materno",
  "dh_nombres",
  "viv_calle",
  "fecha_creacion",
  "fecha_modificacion",
];

export function solicitudAvaluoNombre(record) {
  const nombre = [record?.dh_nombres, record?.dh_apellido_paterno, record?.dh_apellido_materno].filter(Boolean).join(" ");
  return nombre || "Sin nombre";
}
