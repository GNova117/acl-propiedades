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

// Separa un "nombre completo" (como se captura en Clientes y en
// Perfilamiento, un solo campo de texto) en nombre(s) + apellido paterno +
// apellido materno, para precargar la solicitud — que sí pide los 3 por
// separado, como el formato INFONAVIT en papel. Es un best-effort (el
// patrón mexicano más común es "Nombre(s) ApellidoPaterno ApellidoMaterno"):
// la pantalla deja los 3 campos editables para corregirlo antes de guardar.
export function splitNombreCompleto(fullName) {
  const palabras = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return { nombres: "", apellidoPaterno: "", apellidoMaterno: "" };
  if (palabras.length === 1) return { nombres: palabras[0], apellidoPaterno: "", apellidoMaterno: "" };
  if (palabras.length === 2) return { nombres: palabras[0], apellidoPaterno: palabras[1], apellidoMaterno: "" };
  if (palabras.length === 3) return { nombres: palabras[0], apellidoPaterno: palabras[1], apellidoMaterno: palabras[2] };
  return {
    nombres: palabras.slice(0, -2).join(" "),
    apellidoPaterno: palabras[palabras.length - 2],
    apellidoMaterno: palabras[palabras.length - 1],
  };
}

// Quita claves con valor vacío, para que el autollenado solo aporte lo que
// de verdad trae el cliente/propiedad y no pise campos ya llenos con "".
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value != null && value !== ""));
}

// Datos del derechohabiente (sección 1) a partir del cliente elegido y, si
// existe, su perfilamiento de comprador más reciente — que trae NSS,
// teléfono y domicilio capturados con más detalle que el registro general
// del cliente.
export function clienteToDerechohabiente(client, perfilComprador) {
  if (!client) return {};
  // El perfilamiento, cuando existe, trae el detalle más fresco (se captura
  // en una sesión dedicada); si no, se usan los campos de identificación
  // `dh_*` capturados directo en el cliente y, a falta de esos, se parte su
  // nombre completo.
  const nombreCompleto = splitNombreCompleto(client.name);
  const { nombres, apellidoPaterno, apellidoMaterno } = perfilComprador?.nombre
    ? splitNombreCompleto(perfilComprador.nombre)
    : {
        nombres: client.dh_nombres || nombreCompleto.nombres,
        apellidoPaterno: client.dh_apellido_paterno || nombreCompleto.apellidoPaterno,
        apellidoMaterno: client.dh_apellido_materno || nombreCompleto.apellidoMaterno,
      };
  return compact({
    nss: perfilComprador?.nss || client.nss,
    dh_apellido_paterno: apellidoPaterno,
    dh_apellido_materno: apellidoMaterno,
    dh_nombres: nombres,
    dh_calle_numero: perfilComprador?.domicilio || client.dh_calle_numero,
    dh_colonia: client.dh_colonia,
    dh_municipio: client.dh_municipio,
    dh_estado: client.dh_estado,
    dh_codigo_postal: client.dh_codigo_postal,
    dh_telefono_casa: client.dh_telefono_casa,
    dh_telefono_trabajo: client.dh_telefono_trabajo,
    dh_telefono_celular: perfilComprador?.telefono || client.dh_telefono_celular || client.phone,
  });
}

// Datos del propietario actual de la vivienda (sección 2) a partir de un
// cliente (normalmente el vendedor de la operación) y, si existe, su
// perfilamiento de vendedor más reciente.
export function clienteToPropietario(client, perfilVendedor) {
  if (!client) return {};
  const { nombres, apellidoPaterno, apellidoMaterno } = splitNombreCompleto(perfilVendedor?.nombre_completo || client.name);
  return compact({
    prop_apellido_paterno: apellidoPaterno,
    prop_apellido_materno: apellidoMaterno,
    prop_nombre_razon_social: [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" "),
    prop_rfc: perfilVendedor?.rfc,
    prop_calle_numero: perfilVendedor?.domicilio,
    prop_telefono_celular: perfilVendedor?.telefono || client.phone,
  });
}

// Datos de la vivienda (sección 3) a partir de la propiedad elegida del
// catálogo. properties solo trae dirección y zona en un solo renglón cada
// una (no colonia/municipio/estado/CP por separado), así que eso es lo que
// se puede precargar; el resto se completa a mano.
export function propiedadToVivienda(property) {
  if (!property) return {};
  return compact({
    viv_calle: property.address,
    viv_colonia: property.zone,
  });
}
