// Datos del expediente que se capturan junto con el cliente: los datos
// personales (fecha de nacimiento, estado civil, domicilio, RFC, CURP,
// identificación oficial) de cualquier cliente; del comprador además el
// NSS, la contraseña del portal de crédito, los datos de la empresa donde
// trabaja y 2 referencias personales; del vendedor el número de crédito.
//
// Estos mismos datos también se capturan en el perfilamiento (a petición
// explícita del negocio se piden en los dos lados). Para no hacer que el
// usuario los teclee dos veces, AdminClientProfiling.jsx precarga un
// perfilamiento nuevo con lo que ya haya en el cliente (ver
// perfilamientoVendedor.js/perfilamientoComprador.js) usando las mismas
// llaves que aquí. Aun así cada perfilamiento guarda su propia copia, para
// no romper si luego se corrige el cliente.
//
// Las etiquetas van en español directo, igual que perfilamientoComprador.js
// /perfilamientoVendedor.js: son definiciones que se usan tanto para pintar
// el formulario como para imprimir la hoja membretada.

import { ESTADOS_CIVILES } from "./perfilamientoShared";

// Comunes a comprador y vendedor — mismas llaves que la sección de datos
// generales de cada perfilamiento, para que la precarga sea directa.
export const CLIENT_PERSONAL_FIELDS = [
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" },
  { key: "estado_civil", label: "Estado civil", type: "select", options: ESTADOS_CIVILES },
  { key: "domicilio", label: "Domicilio", type: "textarea", full: true },
  { key: "rfc", label: "RFC", type: "text" },
  { key: "curp", label: "CURP", type: "text" },
  { key: "identificacion_oficial", label: "Número de identificación oficial", type: "text" },
];

export const CLIENT_BUYER_FIELDS = [
  { key: "nss", label: "Número de seguro social (NSS)", type: "text" },
  // Contraseña del portal de crédito (INFONAVIT/FOVISSSTE/banco), no del
  // sistema — mismo riesgo aceptado que en el perfilamiento, ver README.
  { key: "contrasena_portal", label: "Contraseña del portal (INFONAVIT/FOVISSSTE/banco)", type: "text", sensitive: true },
];

// Empresa donde trabaja el comprador: es lo que pide el trámite de crédito
// para comprobar la relación laboral. Mismas llaves que en el perfilamiento
// del comprador (`tel_empresa` es el número de la empresa).
export const CLIENT_COMPANY_FIELDS = [
  { key: "razon_social", label: "Razón social", type: "text", full: true },
  { key: "registro_patronal", label: "Registro patronal", type: "text" },
  { key: "tel_empresa", label: "Número de la empresa", type: "tel" },
];

export const CLIENT_SELLER_FIELDS = [{ key: "numero_credito", label: "Número de crédito", type: "text" }];

// Domicilio y teléfonos que pide la Solicitud de avalúo INFONAVIT en su
// sección "Datos de identificación del derechohabiente" — mismas llaves que
// SOLICITUD_AVALUO_SECTIONS en solicitudAvaluo.js (prefijo `dh_`), para que
// clienteToDerechohabiente() los tome directo del cliente sin volver a
// teclearlos. Solo aplica si el financiamiento es INFONAVIT (ver
// clients.financiamiento) — por eso no entra en clientExpedienteGroups
// (que agrupa por tipo de cliente, no por financiamiento): AdminClientForm.jsx
// la muestra aparte, condicionada a `form.financiamiento === "infonavit"`.
export const CLIENT_INFONAVIT_FIELDS = [
  { key: "dh_calle_numero", label: "Calle y número", type: "text", full: true },
  { key: "dh_colonia", label: "Colonia o fraccionamiento", type: "text" },
  { key: "dh_municipio", label: "Municipio o delegación", type: "text" },
  { key: "dh_estado", label: "Estado (entidad)", type: "text" },
  { key: "dh_codigo_postal", label: "Código postal", type: "text" },
  { key: "dh_telefono_casa", label: "Teléfono casa", type: "tel" },
  { key: "dh_telefono_trabajo", label: "Teléfono trabajo", type: "tel" },
];

export const CLIENT_REFERENCE_FIELDS = [1, 2].flatMap((n) => [
  { key: `referencia${n}_nombre`, label: `Referencia ${n} — nombre completo`, type: "text" },
  { key: `referencia${n}_telefono`, label: `Referencia ${n} — número de teléfono`, type: "tel" },
  { key: `referencia${n}_correo`, label: `Referencia ${n} — correo`, type: "email" },
  { key: `referencia${n}_direccion`, label: `Referencia ${n} — dirección`, type: "text", full: true },
]);

export const CLIENT_EXPEDIENTE_KEYS = [
  ...CLIENT_PERSONAL_FIELDS,
  ...CLIENT_BUYER_FIELDS,
  ...CLIENT_COMPANY_FIELDS,
  ...CLIENT_SELLER_FIELDS,
  ...CLIENT_REFERENCE_FIELDS,
  ...CLIENT_INFONAVIT_FIELDS,
].map((f) => f.key);

const PERSONAL_TITLE = "Datos personales";
const COMPANY_TITLE = "Datos de la empresa";
const REFERENCES_TITLE = "Referencias personales";
export const INFONAVIT_TITLE = "Domicilio y teléfonos (Solicitud de avalúo INFONAVIT)";

// Qué se le pide a un cliente según su tipo: los datos personales a
// cualquiera; al comprador además el crédito, la empresa y las referencias;
// al vendedor el número de crédito. Un cliente "ambos" ve todo. Se devuelve
// por bloques para que el formulario y la hoja membretada muestren los
// mismos encabezados.
export function clientExpedienteGroups(clientType) {
  const groups = [{ key: "personal", title: PERSONAL_TITLE, fields: CLIENT_PERSONAL_FIELDS }];
  if (clientType !== "vendedor") {
    groups.push({ key: "credito", title: "Datos del crédito", fields: CLIENT_BUYER_FIELDS });
    groups.push({ key: "empresa", title: COMPANY_TITLE, fields: CLIENT_COMPANY_FIELDS });
    groups.push({ key: "referencias", title: REFERENCES_TITLE, fields: CLIENT_REFERENCE_FIELDS });
  }
  if (clientType !== "comprador") {
    groups.push({ key: "venta", title: "Datos de la venta", fields: CLIENT_SELLER_FIELDS });
  }
  return groups;
}

const ROL_LABELS = { comprador: "Comprador", vendedor: "Vendedor", ambos: "Comprador y vendedor" };

// Secciones de la hoja de datos del cliente en el expediente — mismo formato
// que consumen buildPerfilamientoPdf/PerfilamientoManager (los campos vacíos
// no se imprimen y una sección `optional` sin nada se omite completa).
export function clientSheetSections(client) {
  const datos = {
    key: "cliente",
    title: "Datos del cliente",
    fields: [
      { key: "name", label: "Nombre completo", type: "text" },
      { key: "rol", label: "Rol en el expediente", type: "text" },
      { key: "phone", label: "Número de teléfono", type: "tel" },
      { key: "email", label: "Correo", type: "email" },
      ...CLIENT_PERSONAL_FIELDS,
      ...(client.type !== "vendedor" ? CLIENT_BUYER_FIELDS : []),
      ...(client.type !== "comprador" ? CLIENT_SELLER_FIELDS : []),
      { key: "notes", label: "Notas", type: "textarea", full: true },
    ],
  };

  const sections = [datos];
  if (client.type !== "vendedor") {
    sections.push({ key: "empresa", title: COMPANY_TITLE, optional: true, fields: CLIENT_COMPANY_FIELDS });
    sections.push({ key: "referencias", title: REFERENCES_TITLE, optional: true, fields: CLIENT_REFERENCE_FIELDS });
  }
  if (client.financiamiento === "infonavit") {
    sections.push({ key: "infonavit", title: INFONAVIT_TITLE, optional: true, fields: CLIENT_INFONAVIT_FIELDS });
  }
  return sections;
}

// `rol` no es columna de la tabla: se deriva del tipo de cliente para que la
// hoja diga si es el comprador o el vendedor de la operación.
export function clientSheetData(client) {
  return { ...client, rol: ROL_LABELS[client.type] || client.type };
}
