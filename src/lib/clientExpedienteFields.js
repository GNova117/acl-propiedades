// Datos del expediente que se capturan junto con el cliente: los datos
// personales (fecha de nacimiento, estado civil, domicilio, RFC, CURP,
// identificación oficial) y las 2 referencias personales de cualquier cliente;
// del comprador además los datos de la empresa donde trabaja; y con crédito
// INFONAVIT, de cualquiera, el número de crédito, el NSS y la contraseña de Mi
// Cuenta Infonavit. Cuáles son obligatorios: requiredClientKeys.
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


// Comunes a comprador y vendedor — mismas llaves que la sección de datos
// generales de cada perfilamiento, para que la precarga sea directa.
// El expediente del cliente solo maneja estos dos estados civiles (el perfilamiento conserva su lista más larga).
export const CLIENT_ESTADOS_CIVILES = ["Soltero", "Casado"];

export const CLIENT_PERSONAL_FIELDS = [
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" },
  { key: "estado_civil", label: "Estado civil", type: "select", options: CLIENT_ESTADOS_CIVILES },
  { key: "domicilio", label: "Domicilio", type: "textarea", full: true },
  { key: "rfc", label: "RFC", type: "text" },
  { key: "curp", label: "CURP", type: "text" },
  { key: "identificacion_oficial", label: "Número de identificación oficial", type: "text" },
];

export const CLIENT_BUYER_FIELDS = [
  { key: "nss", label: "Número de seguro social (NSS)", type: "text" },
  // Contraseña del portal de crédito (INFONAVIT/FOVISSSTE/banco), no del
  // sistema — mismo riesgo aceptado que en el perfilamiento, ver README.
  { key: "contrasena_portal", label: "Contraseña de Mi Cuenta Infonavit", type: "text", sensitive: true },
];

// Sección 1 ("Datos de identificación del derechohabiente") de la Solicitud
// de avalúo y de la Solicitud de crédito INFONAVIT — mismas claves `dh_*`
// que usa solicitudAvaluo.js (clienteToDerechohabiente las toma de aquí
// antes de recurrir al perfilamiento o de partir el nombre completo).
// Nombre, apellidos, CURP, RFC y domicilio van en mayúsculas porque así los
// pide el formato oficial impreso.
export const CLIENT_DERECHOHABIENTE_FIELDS = [
  { key: "dh_apellido_paterno", label: "Apellido paterno", type: "text", uppercase: true },
  { key: "dh_apellido_materno", label: "Apellido materno", type: "text", uppercase: true },
  { key: "dh_nombres", label: "Nombre(s)", type: "text", uppercase: true },
  { key: "dh_curp", label: "CURP", type: "text", uppercase: true },
  { key: "dh_rfc", label: "RFC", type: "text", uppercase: true },
  { key: "dh_calle_numero", label: "Calle y número", type: "text", full: true, uppercase: true },
  { key: "dh_colonia", label: "Colonia o fraccionamiento", type: "text", uppercase: true },
  { key: "dh_municipio", label: "Municipio o delegación", type: "text", uppercase: true },
  { key: "dh_estado", label: "Estado (entidad)", type: "text", uppercase: true },
  { key: "dh_codigo_postal", label: "Código postal", type: "text" },
  { key: "dh_telefono_casa", label: "Teléfono casa", type: "tel" },
  { key: "dh_telefono_trabajo", label: "Teléfono trabajo", type: "tel" },
  { key: "dh_telefono_celular", label: "Teléfono celular", type: "tel" },
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

// Datos del crédito INFONAVIT en el formulario del asesor: los tres se capturan con cualquier tipo de cliente (comprador,
// vendedor o ambos) cuando el financiamiento es INFONAVIT.
export const CLIENT_CREDIT_FIELDS = [...CLIENT_SELLER_FIELDS, ...CLIENT_BUYER_FIELDS];

export const CLIENT_REFERENCE_FIELDS = [1, 2].flatMap((n) => [
  { key: `referencia${n}_nombre`, label: `Referencia ${n} — nombre completo`, type: "text" },
  { key: `referencia${n}_telefono`, label: `Referencia ${n} — número de teléfono`, type: "tel" },
  { key: `referencia${n}_correo`, label: `Referencia ${n} — correo`, type: "email" },
  { key: `referencia${n}_direccion`, label: `Referencia ${n} — dirección`, type: "text", full: true },
]);

export const CLIENT_EXPEDIENTE_KEYS = [
  ...CLIENT_PERSONAL_FIELDS,
  ...CLIENT_DERECHOHABIENTE_FIELDS,
  ...CLIENT_BUYER_FIELDS,
  ...CLIENT_COMPANY_FIELDS,
  ...CLIENT_SELLER_FIELDS,
  ...CLIENT_REFERENCE_FIELDS,
].map((f) => f.key);

const PERSONAL_TITLE = "Datos personales";
const DERECHOHABIENTE_TITLE = "Datos de identificación del derechohabiente";
const COMPANY_TITLE = "Datos de la empresa";
const REFERENCES_TITLE = "Referencias personales";

// Qué se le pide a un cliente según su tipo, por bloques para que el formulario y la hoja membretada muestren los mismos
// encabezados. Siempre se capturan los datos personales y las 2 referencias, y del comprador (o «ambos») además los datos de su
// empresa. Los bloques con `onlyInfonavit` solo se piden con financiamiento INFONAVIT: los datos del crédito (número de
// crédito, NSS y contraseña de Mi Cuenta Infonavit) con cualquier tipo de cliente, y la identificación del derechohabiente
// del comprador.
export function clientExpedienteGroups(clientType) {
  const buyer = clientType !== "vendedor";
  const groups = [{ key: "personal", title: PERSONAL_TITLE, fields: CLIENT_PERSONAL_FIELDS }];
  if (buyer) groups.push({ key: "empresa", title: COMPANY_TITLE, fields: CLIENT_COMPANY_FIELDS });
  groups.push({ key: "referencias", title: REFERENCES_TITLE, fields: CLIENT_REFERENCE_FIELDS });
  if (buyer) groups.push({ key: "derechohabiente", title: DERECHOHABIENTE_TITLE, fields: CLIENT_DERECHOHABIENTE_FIELDS, onlyInfonavit: true });
  groups.push({ key: "credito", title: "Datos del crédito Infonavit", fields: CLIENT_CREDIT_FIELDS, onlyInfonavit: true });
  return groups;
}

// Datos que NO se pueden dejar vacíos al guardar un cliente (la lista del negocio):
//  - Cualquier cliente: nombre completo, fecha de nacimiento, domicilio, estado civil y las 2 referencias personales
//    (nombre y teléfono de cada una).
//  - Comprador (y «ambos»), además: número de teléfono, CURP, RFC y teléfono de su empresa.
//  - Con financiamiento INFONAVIT, cualquier cliente: número de crédito, NSS y contraseña de Mi Cuenta Infonavit.
// Se devuelven en el orden en que aparecen en el formulario; el formulario las marca con * y las valida.
export function requiredClientKeys(client) {
  const buyer = client?.type !== "vendedor";
  const keys = ["name"];
  if (buyer) keys.push("phone");
  keys.push("fecha_nacimiento", "estado_civil", "domicilio");
  if (buyer) keys.push("rfc", "curp", "tel_empresa");
  keys.push("referencia1_nombre", "referencia1_telefono", "referencia2_nombre", "referencia2_telefono");
  if (client?.financiamiento === "infonavit") keys.push(...CLIENT_CREDIT_FIELDS.map((f) => f.key));
  return keys;
}

// Llaves obligatorias que siguen vacías (espacios no cuentan).
export const missingRequiredClient = (client) => requiredClientKeys(client).filter((key) => !String(client?.[key] ?? "").trim());

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
      ...CLIENT_CREDIT_FIELDS,
      { key: "notes", label: "Notas", type: "textarea", full: true },
    ],
  };

  const sections = [datos];
  if (client.type !== "vendedor") {
    sections.push({ key: "derechohabiente", title: DERECHOHABIENTE_TITLE, optional: true, fields: CLIENT_DERECHOHABIENTE_FIELDS });
    sections.push({ key: "empresa", title: COMPANY_TITLE, optional: true, fields: CLIENT_COMPANY_FIELDS });
  }
  sections.push({ key: "referencias", title: REFERENCES_TITLE, optional: true, fields: CLIENT_REFERENCE_FIELDS });
  return sections;
}

// `rol` no es columna de la tabla: se deriva del tipo de cliente para que la
// hoja diga si es el comprador o el vendedor de la operación.
export function clientSheetData(client) {
  return { ...client, rol: ROL_LABELS[client.type] || client.type };
}
