// Definición de campos de la "Solicitud de Inscripción de Crédito" (formato
// INFONAVIT CRED.1000.25, 3 hojas), organizada en las mismas 11 secciones
// del formato oficial. Usa el mismo motor que Perfilamiento/Solicitud de
// avalúo (perfilamientoShared.js) para validar, armar el payload y generar
// el PDF — ver solicitudCreditoPdf.js para el llenado del PDF real.
//
// A diferencia de la Solicitud de avalúo (que es una imagen escaneada), este
// formato SÍ trae campos de formulario reales (AcroForm) — el PDF se llena
// por nombre de campo, no por coordenadas. Cada "radio"/"select" de aquí
// tiene una lista de opciones con una etiqueta legible y el valor interno
// que ese campo usa en el PDF oficial (ver RADIO_OPTION_MAPS más abajo).

import { splitNombreCompleto } from "./solicitudAvaluo";

export const PRODUCTO_OPTIONS = ["Infonavit", "Infonavit Total", "Cofinavit", "Cofinavit Ingresos Adicionales"];
export const TIPO_CREDITO_OPTIONS = ["Individual", "Conyugal", "Corresidencial", "Familiar"];
export const TIPO_CREDITO_CORRESIDENCIAL_OPTIONS = ["Pareja", "Amigo (a)"];
export const FAMILIAR_OPTIONS = ["Progenitor (a)", "Hijo (a)", "Hermano (a)"];
export const DESTINO_CREDITO_CREDITO_OPTIONS = [
  "Comprar una Vivienda",
  "Comprar Terreno",
  "Comprar terreno y construir una vivienda",
  "Construir Vivienda",
  "Reparar, Ampliar o Mejorar la Vivienda",
  "Compra y Mejora de Vivienda",
  "Pagar el Pasivo o la Hipoteca de la Vivienda con garantía hipotecaria",
  "Pagar el Pasivo o la Hipoteca de la Vivienda con garantía del Saldo de Subcuenta de Vivienda",
];
export const SI_NO_OPTIONS = ["Sí", "No"];
export const TIPO_DISCAPACIDAD_OPTIONS = ["Motriz", "Auditiva", "Mental", "Visual"];
export const PERSONA_DISCAPACIDAD_OPTIONS = ["Derechohabiente solicitante", "Cónyuge", "Padre", "Madre", "Hijo"];
export const GENERO_OPTIONS = ["Masculino", "Femenino"];
export const ESTADO_CIVIL_CREDITO_OPTIONS = ["Soltero (a)", "Casado (a)"];
export const REGIMEN_PATRIMONIAL_OPTIONS = ["Separación de Bienes", "Sociedad Conyugal", "Sociedad Legal"];
export const VENDEDOR_TIPO_OPTIONS = [
  "Vendedor y/o apoderado del vendedor",
  "Agente inmobiliario",
  "Administradora designada para construcción",
  "Derechohabiente",
  "Emprendedor",
];
export const CONTACTO_TIPO_OPTIONS = ["Promotor de ventas", "Emprendedor", "Agente inmobiliario"];
export const OFERTA_VINCULANTE_CREDITO_OPTIONS = ["Sí", "No"];

export const SOLICITUD_CREDITO_SECTIONS = [
  {
    key: "credito",
    title: "1. Crédito solicitado",
    titleKey: "solicitudCredito.sections.credito",
    fields: [
      { key: "producto", label: "Producto", type: "select", options: PRODUCTO_OPTIONS, required: true },
      { key: "entidad_financiera", label: "Entidad financiera", type: "text", full: true },
      { key: "tipo_credito", label: "Tipo de crédito", type: "select", options: TIPO_CREDITO_OPTIONS, required: true },
      {
        key: "tipo_credito_corresidencial",
        label: "Corresidencial",
        type: "select",
        options: TIPO_CREDITO_CORRESIDENCIAL_OPTIONS,
        dependsOn: { field: "tipo_credito", value: "Corresidencial" },
      },
      {
        key: "familiar",
        label: "Familiar",
        type: "select",
        options: FAMILIAR_OPTIONS,
        dependsOn: { field: "tipo_credito", value: "Familiar" },
      },
      {
        key: "destino_credito",
        label: "Destino del crédito",
        type: "select",
        options: DESTINO_CREDITO_CREDITO_OPTIONS,
        required: true,
        full: true,
      },
    ],
  },
  {
    key: "monto",
    title: "2. Datos para determinar el monto de crédito",
    titleKey: "solicitudCredito.sections.monto",
    optional: true,
    fields: [
      { key: "desc_pension_dh", label: "Descuento mensual por pensión alimenticia — derechohabiente", type: "number" },
      { key: "desc_pension_cfc", label: "Descuento mensual por pensión alimenticia — cónyuge/familiar", type: "number" },
      { key: "monto_credito_dh", label: "Monto de crédito solicitado — derechohabiente", type: "number" },
      { key: "monto_credito_cfc", label: "Monto de crédito solicitado — cónyuge/familiar", type: "number" },
      { key: "monto_ahorro", label: "Monto de ahorro voluntario", type: "number" },
      { key: "equipa_tu_casa", label: "¿Desea adquirir el complemento \"Equipa tu Casa\"?", type: "select", options: SI_NO_OPTIONS },
    ],
  },
  {
    key: "vivienda",
    title: "3. Datos de la vivienda/terreno destino del crédito",
    titleKey: "solicitudCredito.sections.vivienda",
    fields: [
      { key: "viv_calle", label: "Calle", type: "text", required: true, full: true },
      { key: "viv_num_ext", label: "No. Ext.", type: "text" },
      { key: "viv_num_int", label: "No. Int.", type: "text" },
      { key: "viv_lote", label: "Lote", type: "text" },
      { key: "viv_mza", label: "Mza.", type: "text" },
      { key: "viv_colonia", label: "Colonia o fraccionamiento", type: "text", required: true },
      { key: "viv_entidad", label: "Entidad", type: "text", required: true },
      { key: "viv_municipio", label: "Municipio o delegación", type: "text", required: true },
      { key: "viv_cp", label: "Código postal", type: "text" },
      { key: "discapacidad", label: "¿La vivienda elegida es para una persona con discapacidad?", type: "select", options: SI_NO_OPTIONS },
      {
        key: "tipo_discapacidad",
        label: "Tipo de discapacidad",
        type: "select",
        options: TIPO_DISCAPACIDAD_OPTIONS,
        dependsOn: { field: "discapacidad", value: "Sí" },
      },
      {
        key: "persona_discapacidad",
        label: "Persona que presentará comprobante de discapacidad",
        type: "select",
        options: PERSONA_DISCAPACIDAD_OPTIONS,
        dependsOn: { field: "discapacidad", value: "Sí" },
      },
      { key: "precio_compraventa", label: "Precio de compra-venta", type: "number" },
      { key: "monto_presupuesto_construccion", label: "Monto del presupuesto (construir)", type: "number" },
      { key: "monto_presupuesto_reparar", label: "Monto del presupuesto (reparar/ampliar/mejorar)", type: "number" },
      { key: "monto_deuda", label: "Monto de la deuda (pagar pasivo/hipoteca)", type: "number" },
      { key: "afectacion_estructural", label: "Afectación estructural", type: "select", options: SI_NO_OPTIONS },
    ],
  },
  {
    key: "empresa",
    title: "4. Datos de la empresa o patrón",
    titleKey: "solicitudCredito.sections.empresa",
    fields: [
      { key: "empresa_nombre", label: "Nombre de la empresa o patrón", type: "text", required: true, full: true },
      { key: "empresa_nrp", label: "Número de Registro Patronal (NRP)", type: "text", required: true, uppercase: true },
      { key: "empresa_lada", label: "Lada", type: "text" },
      { key: "empresa_numero", label: "Teléfono de la empresa", type: "tel" },
      { key: "empresa_ext", label: "Extensión", type: "text" },
    ],
  },
  {
    key: "derechohabiente",
    title: "5. Datos de identificación del (de la) derechohabiente",
    titleKey: "solicitudCredito.sections.derechohabiente",
    fields: [
      { key: "nss", label: "Número de Seguridad Social (NSS)", type: "text", format: "nss", required: true },
      { key: "curp", label: "CURP", type: "text", format: "curp", uppercase: true },
      { key: "rfc", label: "RFC", type: "text", format: "rfc", uppercase: true },
      { key: "apellido_paterno", label: "Apellido paterno", type: "text", required: true, uppercase: true },
      { key: "apellido_materno", label: "Apellido materno", type: "text", uppercase: true },
      { key: "nombres", label: "Nombre(s)", type: "text", required: true, uppercase: true },
      { key: "domicilio_calle", label: "Calle y número", type: "text", full: true },
      { key: "domicilio_colonia", label: "Colonia o fraccionamiento", type: "text" },
      { key: "domicilio_entidad", label: "Entidad", type: "text" },
      { key: "domicilio_delegacion", label: "Municipio o delegación", type: "text" },
      { key: "domicilio_cp", label: "Código postal", type: "text" },
      { key: "telefono_lada", label: "Teléfono — lada", type: "text" },
      { key: "telefono_numero", label: "Teléfono — número", type: "text" },
      { key: "celular", label: "Celular", type: "tel", format: "telefono" },
      { key: "email", label: "Correo electrónico", type: "email", format: "email" },
      { key: "genero", label: "Género", type: "select", options: GENERO_OPTIONS },
      { key: "estado_civil", label: "Estado civil", type: "select", options: ESTADO_CIVIL_CREDITO_OPTIONS },
      {
        key: "regimen_patrimonial",
        label: "Régimen patrimonial del matrimonio",
        type: "select",
        options: REGIMEN_PATRIMONIAL_OPTIONS,
        dependsOn: { field: "estado_civil", value: "Casado (a)" },
      },
    ],
  },
  {
    key: "cfc",
    title: "6. Datos de identificación del cónyuge, familiar o corresidente",
    titleKey: "solicitudCredito.sections.cfc",
    optional: true,
    fields: [
      { key: "cfc_nss", label: "NSS", type: "text", format: "nss" },
      { key: "cfc_curp", label: "CURP", type: "text", format: "curp", uppercase: true },
      { key: "cfc_rfc", label: "RFC", type: "text", format: "rfc", uppercase: true },
      { key: "cfc_apellido_paterno", label: "Apellido paterno", type: "text", uppercase: true },
      { key: "cfc_apellido_materno", label: "Apellido materno", type: "text", uppercase: true },
      { key: "cfc_nombre", label: "Nombre(s)", type: "text", uppercase: true, full: true },
      { key: "cfc_lada", label: "Teléfono — lada", type: "text" },
      { key: "cfc_numero", label: "Teléfono — número", type: "text" },
      { key: "cfc_celular", label: "Celular", type: "tel", format: "telefono" },
      { key: "cfc_email", label: "Correo electrónico", type: "email", format: "email" },
      { key: "cfc_genero", label: "Género", type: "select", options: GENERO_OPTIONS },
      { key: "cfc_empresa_nombre", label: "Nombre de la empresa o patrón", type: "text", full: true },
      { key: "cfc_empresa_nrp", label: "Número de Registro Patronal (NRP)", type: "text", uppercase: true },
    ],
  },
  {
    key: "referencias",
    title: "7. Referencias familiares del (de la) derechohabiente",
    titleKey: "solicitudCredito.sections.referencias",
    optional: true,
    fields: [
      { key: "ref1_paterno", label: "Referencia 1 — apellido paterno", type: "text", uppercase: true },
      { key: "ref1_materno", label: "Referencia 1 — apellido materno", type: "text", uppercase: true },
      { key: "ref1_nombre", label: "Referencia 1 — nombre(s)", type: "text", uppercase: true },
      { key: "ref1_lada", label: "Referencia 1 — teléfono lada", type: "text" },
      { key: "ref1_numero", label: "Referencia 1 — teléfono número", type: "text" },
      { key: "ref1_celular", label: "Referencia 1 — celular", type: "tel" },
      { key: "ref1_calle", label: "Referencia 1 — calle y número", type: "text", full: true },
      { key: "ref1_colonia", label: "Referencia 1 — colonia o fraccionamiento", type: "text" },
      { key: "ref1_entidad", label: "Referencia 1 — entidad", type: "text" },
      { key: "ref1_delegacion", label: "Referencia 1 — municipio o delegación", type: "text" },
      { key: "ref1_cp", label: "Referencia 1 — código postal", type: "text" },
      { key: "ref2_paterno", label: "Referencia 2 — apellido paterno", type: "text", uppercase: true },
      { key: "ref2_materno", label: "Referencia 2 — apellido materno", type: "text", uppercase: true },
      { key: "ref2_nombre", label: "Referencia 2 — nombre(s)", type: "text", uppercase: true },
      { key: "ref2_lada", label: "Referencia 2 — teléfono lada", type: "text" },
      { key: "ref2_numero", label: "Referencia 2 — teléfono número", type: "text" },
      { key: "ref2_celular", label: "Referencia 2 — celular", type: "tel" },
      { key: "ref2_calle", label: "Referencia 2 — calle y número", type: "text", full: true },
      { key: "ref2_colonia", label: "Referencia 2 — colonia o fraccionamiento", type: "text" },
      { key: "ref2_entidad", label: "Referencia 2 — entidad", type: "text" },
      { key: "ref2_delegacion", label: "Referencia 2 — municipio o delegación", type: "text" },
      { key: "ref2_cp", label: "Referencia 2 — código postal", type: "text" },
    ],
  },
  {
    key: "abono",
    title: "8. Datos para abono en cuenta del crédito",
    titleKey: "solicitudCredito.sections.abono",
    optional: true,
    fields: [
      { key: "vendedor_tipo", label: "Datos del", type: "select", options: VENDEDOR_TIPO_OPTIONS, full: true },
      { key: "vendedor_nombre", label: "Nombre o denominación o razón social", type: "text", full: true },
      { key: "vendedor_rfc", label: "RFC", type: "text", format: "rfc", uppercase: true },
      { key: "vendedor_razon_social_cuenta", label: "Nombre como aparece en el estado de cuenta", type: "text", full: true },
      { key: "vendedor_clabe", label: "CLABE", type: "text", full: true },
      { key: "acreedor_nombre", label: "Acreedor hipotecario — nombre o razón social", type: "text", full: true },
      { key: "acreedor_rfc", label: "Acreedor hipotecario — RFC", type: "text", uppercase: true },
      { key: "acreedor_razon_social_cuenta", label: "Acreedor hipotecario — nombre en estado de cuenta", type: "text", full: true },
      { key: "acreedor_clabe", label: "Acreedor hipotecario — CLABE", type: "text", full: true },
      { key: "numero_credito_titular", label: "Número de crédito otorgado por Infonavit — titular", type: "text" },
      { key: "numero_credito_cfc", label: "Número de crédito otorgado por Infonavit — cónyuge/familiar", type: "text" },
      { key: "numero_inventario_vr", label: "Número de inventario vivienda recuperada", type: "text" },
      { key: "numero_credito_entidad", label: "Número de crédito de la entidad financiera", type: "text" },
    ],
  },
  {
    key: "representante",
    title: "9. Designación de representante",
    titleKey: "solicitudCredito.sections.representante",
    optional: true,
    fields: [
      { key: "repres_paterno", label: "Apellido paterno", type: "text", uppercase: true },
      { key: "repres_materno", label: "Apellido materno", type: "text", uppercase: true },
      { key: "repres_nombre", label: "Nombre(s)", type: "text", uppercase: true, full: true },
      { key: "repres_lada", label: "Teléfono — lada", type: "text" },
      { key: "repres_numero", label: "Teléfono — número", type: "text" },
      { key: "repres_celular", label: "Celular", type: "tel" },
      { key: "repres_identificacion", label: "Número (credencial INE / pasaporte)", type: "text" },
    ],
  },
  {
    key: "contacto",
    title: "10. Datos de identificación del contacto",
    titleKey: "solicitudCredito.sections.contacto",
    optional: true,
    fields: [
      { key: "contacto_tipo", label: "Tipo de contacto", type: "select", options: CONTACTO_TIPO_OPTIONS },
      { key: "contacto_curp", label: "CURP", type: "text", format: "curp", uppercase: true },
      { key: "contacto_paterno", label: "Apellido paterno", type: "text", uppercase: true },
      { key: "contacto_materno", label: "Apellido materno", type: "text", uppercase: true },
      { key: "contacto_nombre", label: "Nombre(s)", type: "text", uppercase: true, full: true },
      { key: "contacto_lada", label: "Teléfono — lada", type: "text" },
      { key: "contacto_numero", label: "Teléfono — número", type: "text" },
    ],
  },
  {
    key: "cierre",
    title: "11. Oferta vinculante",
    titleKey: "solicitudCredito.sections.cierre",
    fields: [
      { key: "oferta_vinculante", label: "¿Requiere oferta vinculante?", type: "select", options: OFERTA_VINCULANTE_CREDITO_OPTIONS },
      { key: "ciudad", label: "Ciudad", type: "text" },
      { key: "fecha_solicitud", label: "Fecha de la solicitud", type: "date" },
    ],
  },
];

export const SOLICITUD_CREDITO_LIST_FIELDS = [
  "id",
  "cliente_id",
  "propiedad_id",
  "destino_credito",
  "apellido_paterno",
  "apellido_materno",
  "nombres",
  "viv_calle",
  "fecha_creacion",
  "fecha_modificacion",
];

export function solicitudCreditoNombre(record) {
  const nombre = [record?.nombres, record?.apellido_paterno, record?.apellido_materno].filter(Boolean).join(" ");
  return nombre || "Sin nombre";
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value != null && value !== ""));
}

// Precarga la sección 5 (derechohabiente) a partir del cliente elegido y,
// si existe, su perfilamiento de comprador — mismo criterio que la
// Solicitud de avalúo (splitNombreCompleto importado de ahí para no
// duplicar el mismo best-effort de separar nombre completo).
export function clienteToDerechohabienteCredito(client, perfilComprador) {
  if (!client) return {};
  // Mismo criterio que clienteToDerechohabiente (Solicitud de avalúo): el
  // perfilamiento manda si existe; si no, se usan los campos `dh_*`
  // capturados directo en el cliente.
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
    curp: perfilComprador?.curp || client.dh_curp || client.curp,
    rfc: perfilComprador?.rfc || client.dh_rfc || client.rfc,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    nombres,
    domicilio_calle: perfilComprador?.domicilio || client.dh_calle_numero || client.domicilio,
    domicilio_colonia: client.dh_colonia,
    domicilio_entidad: client.dh_estado,
    domicilio_delegacion: client.dh_municipio,
    domicilio_cp: client.dh_codigo_postal,
    celular: perfilComprador?.telefono || client.dh_telefono_celular || client.phone,
    email: perfilComprador?.correo || client.email,
  });
}

// Precarga la sección 3 (vivienda/terreno) a partir de la propiedad elegida.
export function propiedadToViviendaCredito(property) {
  if (!property) return {};
  return compact({
    viv_calle: property.address,
    viv_colonia: property.zone,
  });
}
